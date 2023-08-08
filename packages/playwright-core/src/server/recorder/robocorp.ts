/**
 * Copyright (c) Robocorp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {
  Language,
  LanguageGenerator,
  LanguageGeneratorOptions,
} from './language';
import {  toSignalMap } from './language';
import type { ActionInContext } from './codeGenerator';
import type { Action } from './recorderActions';
import type { MouseClickOptions } from './utils';
import { toModifiers } from './utils';
import {
  escapeWithQuotes,
  toSnakeCase,
} from '../../utils/isomorphic/stringUtils';
import { asLocator } from '../../utils/isomorphic/locatorGenerators';

export class RobocorpLanguageGenerator implements LanguageGenerator {
  id: string;
  groupName = 'Python';
  name: string;
  highlighter = 'python' as Language;

  constructor() {
    this.id = 'robocorp';
    this.name = 'Robocorp Library';
  }

  generateAction(actionInContext: ActionInContext): string {
    const action = actionInContext.action;

    const pageAlias = actionInContext.frame.pageAlias;
    const formatter = new PythonFormatter(4);

    if (action.name === 'openPage') {
      if (
        action.url &&
        action.url !== 'about:blank' &&
        action.url !== 'chrome://newtab/'
      )
        formatter.add(`${pageAlias}.goto(${quote(action.url)})`);

      return formatter.format();
    }

    let subject: string;
    if (actionInContext.frame.isMainFrame) {
      subject = pageAlias;
    } else if (
      actionInContext.frame.selectorsChain &&
      action.name !== 'navigate'
    ) {
      const locators = actionInContext.frame.selectorsChain.map(
          selector => `.frame_locator(${quote(selector)})`
      );
      subject = `${pageAlias}${locators.join('')}`;
    } else if (actionInContext.frame.name) {
      subject = `${pageAlias}.frame(${formatOptions(
          { name: actionInContext.frame.name },
          false
      )})`;
    } else {
      subject = `${pageAlias}.frame(${formatOptions(
          { url: actionInContext.frame.url },
          false
      )})`;
    }

    const signals = toSignalMap(action);

    if (signals.dialog) {
      formatter.add(
          `  ${pageAlias}.once("dialog", lambda dialog: dialog.dismiss())`
      );
    }

    const actionCall = this._generateActionCall(action);
    let code = `${subject}.${actionCall}`;

    if (signals.popup) {
      code = `with ${pageAlias}.expect_popup() as ${signals.popup.popupAlias}_info {
        ${code}
      }
      ${signals.popup.popupAlias} = ${signals.popup.popupAlias}_info.value`;
    }

    if (signals.download) {
      code = `with ${pageAlias}.expect_download() as download${signals.download.downloadAlias}_info {
        ${code}
      }
      download${signals.download.downloadAlias} = download${signals.download.downloadAlias}_info.value`;
    }

    formatter.add(code);

    return formatter.format();
  }

  private _generateActionCall(action: Action): string {
    switch (action.name) {
      case 'openPage':
        throw Error('Not reached');
      case 'closePage':
        return 'close()';
      case 'click': {
        let method = 'click';
        if (action.clickCount === 2) method = 'dblclick';
        const modifiers = toModifiers(action.modifiers);
        const options: MouseClickOptions = {};
        if (action.button !== 'left') options.button = action.button;
        if (modifiers.length) options.modifiers = modifiers;
        if (action.clickCount > 2) options.clickCount = action.clickCount;
        if (action.position) options.position = action.position;
        const optionsString = formatOptions(options, false);
        return (
          this._asLocator(action.selector) + `.${method}(${optionsString})`
        );
      }
      case 'check':
        return this._asLocator(action.selector) + `.check()`;
      case 'uncheck':
        return this._asLocator(action.selector) + `.uncheck()`;
      case 'fill':
        return (
          this._asLocator(action.selector) + `.fill(${quote(action.text)})`
        );
      case 'setInputFiles':
        return (
          this._asLocator(action.selector) +
          `.set_input_files(${formatValue(
              action.files.length === 1 ? action.files[0] : action.files
          )})`
        );
      case 'press': {
        const modifiers = toModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return this._asLocator(action.selector) + `.press(${quote(shortcut)})`;
      }
      case 'navigate':
        return `goto(${quote(action.url)})`;
      case 'select':
        return (
          this._asLocator(action.selector) +
          `.select_option(${formatValue(
              action.options.length === 1 ? action.options[0] : action.options
          )})`
        );
    }
  }

  private _asLocator(selector: string) {
    return asLocator('python', selector);
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    const formatter = new PythonFormatter();
    formatter.add(`
from robocorp.tasks import task
from robocorp import browser

def init_browser(): {
    # Configure may be used to set the basic robocorp.browser settings.
    # It must be called prior to calling APIs which create playwright objects.
    browser.configure( {
        screenshot="only-on-failure",
        headless=True,
    }
    )
}

@task
def automate(): {
    init_browser()
    # APIs in robocorp.browser return the same browser instance, which is
    # automatically closed when the task finishes.
    page = browser.page()
    # --------------------- Generated Code:`);

    return formatter.format();
  }

  generateFooter(saveStorage: string | undefined): string {
    return `
    # ---------------------`;
  }
}

function formatValue(value: any): string {
  if (value === false) return 'False';
  if (value === true) return 'True';
  if (value === undefined) return 'None';
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`;
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatOptions(
  value: any,
  hasArguments: boolean,
  asDict?: boolean
): string {
  const keys = Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort();
  if (!keys.length) return '';
  return (
    (hasArguments ? ', ' : '') +
    keys
        .map(key => {
          if (asDict) return `"${toSnakeCase(key)}": ${formatValue(value[key])}`;
          return `${toSnakeCase(key)}=${formatValue(value[key])}`;
        })
        .join(', ')
  );
}

class PythonFormatter {
  private _baseIndent: string;
  private _baseOffset: string;
  private _lines: string[] = [];

  constructor(offset = 0) {
    this._baseIndent = ' '.repeat(4);
    this._baseOffset = ' '.repeat(offset);
  }

  prepend(text: string) {
    this._lines = text.trim().split('\n').map(line => line.trim()).concat(this._lines);
  }

  add(text: string) {
    this._lines.push(...text.trim().split('\n').map(line => line.trim()));
  }

  newLine() {
    this._lines.push('');
  }

  format(): string {
    let spaces = '';
    const lines: string[] = [];
    this._lines.forEach((line: string) => {
      if (line === '')
        return lines.push(line);
      if (line === '}') {
        spaces = spaces.substring(this._baseIndent.length);
        return;
      }

      line = spaces + line;
      if (line.endsWith('{')) {
        spaces += this._baseIndent;
        line = line.substring(0, line.length - 1).trimEnd();
      }
      return lines.push(this._baseOffset + line);
    });
    return lines.join('\n');
  }
}

function quote(text: string) {
  return escapeWithQuotes(text, '\"');
}

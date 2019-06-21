/*

MIT License

Copyright(c) 2018 — 2019 Yogensia

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files(the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and / or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

'use strict';

// The module 'vscode' contains the VS Code extensibility API.
// The module 'path' allows to work with local paths in the VSCode env.
import * as vscode from 'vscode';
import * as path from 'path';

// Request module to perform HTTP requests.
// https://github.com/request/request
import request = require('request');

// Internal modules.
import * as swpd_dictionary from './inc/swpd_dictionary';
import * as webview_html from './inc/webview_html';

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export function activate(context: vscode.ExtensionContext) {
  /**
   * Search in the WordPress Codex/Code Reference.
   */
  let searchWpDocs = new SearchWPDocs();
  let searchCodexDisposable = vscode.commands.registerCommand(
    "extension.searchCodex",
    () => {
      searchWpDocs.searchWPDocs(context);
    },
  );
  let searchCodexLegacyDisposable = vscode.commands.registerCommand(
    "extension.searchCodexLegacy",
    () => {
      searchWpDocs.searchWPDocsLegacy(context);
    },
  );

  /**
   * Dispose.
   */
  context.subscriptions.push(searchCodexDisposable);
  context.subscriptions.push(searchCodexLegacyDisposable);
  context.subscriptions.push(searchWpDocs);
}

/**
 * Handles opening of links.
 *
 * @class SearchWPDocs
 */
class SearchWPDocs {
  constructor() {
  }

  /**
   * Main Command, performs a search inside VSCode.
   */
  async searchWPDocs(context: vscode.ExtensionContext) {
    let searchTerm = "";

    // Get configuration.
    let settings = vscode.workspace.getConfiguration("searchwpdocs");

    // No open text editor.
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // Get search term from selection.
    // If no selection, attempt grow from cursor position.
    if (editor.selection.isEmpty) {
      let selection = editor.document.getWordRangeAtPosition(editor.selection.active);
      searchTerm = editor.document.getText(selection);
    } else {
      let selection = editor.selection;
      searchTerm = editor.document.getText(selection);
    }

    // Check that search term is not empty.
    if (0 === searchTerm.length) {
      vscode.window.showErrorMessage('WPSearchDocs: Nothing to search, select or place cursor on a word first!');
      return;
    }

    // Check that search term doesn't contain several lines.
    if (-1 < searchTerm.indexOf("\n")) {
      vscode.window.showErrorMessage('WPSearchDocs: Please limit selection to one line!');
      return;
    }



    /**
     * Get theme.
     */
    let cssThemeLinkTag = "";

    // If theme = wp-docs then no additional css is needed, just use the default styles.
    if ("wp-docs" !== settings.cssTheme) {
      const onDiskPath = vscode.Uri.file(
        path.join(context.extensionPath, 'styles', 'theme-' + settings.cssTheme + '.css')
      );

      const cssThemeRes = onDiskPath.with({ scheme: 'vscode-resource' });
      cssThemeLinkTag = '<link rel="stylesheet" id = "swpd-theme" href="' + cssThemeRes + '" type="text/css" media="all" />';
    }

    // vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(settings.site + searchTerm));
    // return;

    // HTTP request.
    // const url = 'https://developer.wordpress.org/reference/functions/' + searchTerm;
    // const url = settings.site + searchTerm;

    // Check it search term is a known function or hook.
    let searchString = settings.site + searchTerm;
    let tabName = "";
    let isKnownWord = true;

    if (true == swpd_dictionary.isFunction(searchTerm)) {
      searchString = 'https://developer.wordpress.org/reference/functions/' + searchTerm;
      tabName = searchTerm + '()';
    } else if (true == swpd_dictionary.isHook(searchTerm)) {
      searchString = 'https://developer.wordpress.org/reference/hooks/' + searchTerm;
      tabName = "( '" + searchTerm + "' )";
    } else {
      isKnownWord = false;
      vscode.window.showWarningMessage('WPSearchDocs: Unknown word! Opening Google\'s first result...');
    }

    request({
      headers: {}, // add here headers if you needed
      uri: searchString,
      method: 'GET',
    }, (err, res, body) => {
      var splitted = body.split('<div id="content" class="site-content">', 2);

      // If split doesn have 2 pieces it means we have an unexpected response,
      // If so fallback to on-browser load.
      if (2 == splitted.length) {
        splitted = splitted[1].split('<div id="respond" class="comment-respond">', 1);

        // Create and show webview panel.
        // https://code.visualstudio.com/api/extension-guides/webview
        const panel = vscode.window.createWebviewPanel(
          searchTerm,
          tabName,
          vscode.ViewColumn.Three,
          {
            retainContextWhenHidden: true
          }
        );

        // Set webview panel HTML.
        const headHTML = webview_html.getHtmlHead(isKnownWord, searchString, searchTerm, cssThemeLinkTag);
        const foooterHTML = webview_html.getHtmlFooter();
        panel.webview.html = headHTML + splitted[0].trim() + foooterHTML;
      } else {
        // Try to load page on browser.
        vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(settings.site + searchTerm));
      }
    });
  }

  /**
   * Legacy Command, performs a search in the user's browser.
   */
  async searchWPDocsLegacy(context: vscode.ExtensionContext) {
    let searchTerm = "";

    // Get configuration.
    let settings = vscode.workspace.getConfiguration("searchwpdocs");

    // No open text editor.
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // Get search term from selection.
    // If no selection, attempt grow from cursor position.
    if (editor.selection.isEmpty) {
      let selection = editor.document.getWordRangeAtPosition(editor.selection.active);
      searchTerm = editor.document.getText(selection);
    } else {
      let selection = editor.selection;
      searchTerm = editor.document.getText(selection);
    }

    // Check that search term is not empty.
    if (0 === searchTerm.length) {
      vscode.window.showErrorMessage('WPSearchDocs: Nothing to search, select or place cursor on a word first!');
      return;
    }

    // Check that search term doesn't contain several lines.
    if (-1 < searchTerm.indexOf("\n")) {
      vscode.window.showErrorMessage('WPSearchDocs: Please limit selection to one line!');
      return;
    }

    // Open Gogle's first result on browser.
    vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(settings.site + searchTerm));
  }

  dispose() {
  }
}

// This method is called when your extension is deactivated.
export function deactivate() { }
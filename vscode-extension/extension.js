const path = require('node:path');
const vscode = require('vscode');
const { renderSVG, parseUML } = require('./markuml.cjs');

/**
 * Detect whether the active VS Code color theme is dark.
 */
function getThemeName() {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast
    ? 'dark'
    : 'light';
}

/**
 * Wrap SVG in a clean responsive HTML document for the side preview webview.
 */
function buildPreviewHtml(svg, theme) {
  const bg = theme === 'dark' ? '#0f172a' : '#ffffff';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: ${bg};
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      box-sizing: border-box;
    }
    svg {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  ${svg}
</body>
</html>`;
}

/**
 * Detect user language from VS Code / Antigravity IDE (e.g. 'en', 'pt-BR').
 */
function getLanguage() {
  return vscode.env.language || 'en';
}

/**
 * Extension activation - strictly synchronous return for markdown-it plugin support.
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('markuml');
  context.subscriptions.push(diagnosticCollection);

  /**
   * Validate actors in markdown or markuml documents and surface red squiggly diagnostics.
   * @param {vscode.TextDocument} document
   */
  function validateDocument(document) {
    if (!document) return;
    const isMd = document.languageId === 'markdown';
    const isUml = document.languageId === 'markuml';
    if (!isMd && !isUml) return;

    const text = document.getText();
    const diagnostics = [];

    if (isUml) {
      const ast = parseUML(text, { lang: getLanguage() });
      if (ast.errors && ast.errors.length > 0) {
        for (const err of ast.errors) {
          const lineIdx = Math.max(0, err.line - 1);
          if (lineIdx < document.lineCount) {
            const lineText = document.lineAt(lineIdx).text;
            const colStart = lineText.indexOf(err.actor);
            const start = new vscode.Position(lineIdx, colStart >= 0 ? colStart : 0);
            const end = new vscode.Position(
              lineIdx,
              colStart >= 0 ? colStart + err.actor.length : lineText.length
            );
            const diag = new vscode.Diagnostic(
              new vscode.Range(start, end),
              err.message,
              vscode.DiagnosticSeverity.Error
            );
            diag.source = 'MarkUML';
            diagnostics.push(diag);
          }
        }
      }
    } else if (isMd) {
      const lines = text.split(/\r?\n/);
      let inFence = false;
      let fenceStartLine = 0;
      let blockLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!inFence && /^```(?:uml|markuml)\s*$/i.test(line.trim())) {
          inFence = true;
          fenceStartLine = i + 1; // 0-based index of first line inside code fence
          blockLines = [];
        } else if (inFence && /^```\s*$/i.test(line.trim())) {
          inFence = false;
          const blockContent = blockLines.join('\n');
          const ast = parseUML(blockContent, { lang: getLanguage() });
          if (ast.errors && ast.errors.length > 0) {
            for (const err of ast.errors) {
              const actualLineIdx = fenceStartLine + (err.line - 1);
              if (actualLineIdx < lines.length) {
                const lineText = lines[actualLineIdx];
                const colStart = lineText.indexOf(err.actor);
                const start = new vscode.Position(actualLineIdx, colStart >= 0 ? colStart : 0);
                const end = new vscode.Position(
                  actualLineIdx,
                  colStart >= 0 ? colStart + err.actor.length : lineText.length
                );
                const diag = new vscode.Diagnostic(
                  new vscode.Range(start, end),
                  err.message,
                  vscode.DiagnosticSeverity.Error
                );
                diag.source = 'MarkUML';
                diagnostics.push(diag);
              }
            }
          }
        } else if (inFence) {
          blockLines.push(line);
        }
      }
    }

    diagnosticCollection.set(document.uri, diagnostics);
  }

  // Validate active documents
  vscode.workspace.textDocuments.forEach(validateDocument);

  let currentPanel = null;
  let currentDocUri = null;

  function updatePanel(document) {
    if (!currentPanel || !document) return;
    const theme = getThemeName();
    const lang = getLanguage();
    try {
      const svg = renderSVG(document.getText(), { theme, lang });
      currentPanel.webview.html = buildPreviewHtml(svg, theme);
    } catch (err) {
      currentPanel.webview.html = `<pre style="color:#f87171;padding:16px;background:#1e1e1e;border-radius:6px;">${String(err)}</pre>`;
    }
  }

  const openCmd = vscode.commands.registerCommand('markuml.openPreviewToSide', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    currentDocUri = editor.document.uri.toString();

    if (currentPanel) {
      currentPanel.reveal(vscode.ViewColumn.Beside);
    } else {
      currentPanel = vscode.window.createWebviewPanel(
        'markumlPreview',
        `Preview: ${path.basename(editor.document.fileName)}`,
        vscode.ViewColumn.Beside,
        { enableScripts: false }
      );
      currentPanel.onDidDispose(() => {
        currentPanel = null;
        currentDocUri = null;
      });
    }

    currentPanel.title = `Preview: ${path.basename(editor.document.fileName)}`;
    updatePanel(editor.document);
  });

  const changeSub = vscode.workspace.onDidChangeTextDocument((event) => {
    validateDocument(event.document);
    if (currentPanel && event.document.uri.toString() === currentDocUri) {
      updatePanel(event.document);
    }
  });

  const openDocSub = vscode.workspace.onDidOpenTextDocument((doc) => {
    validateDocument(doc);
  });

  const closeDocSub = vscode.workspace.onDidCloseTextDocument((doc) => {
    diagnosticCollection.delete(doc.uri);
  });

  const editorSub = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      validateDocument(editor.document);
    }
    if (currentPanel && editor && editor.document.languageId === 'markuml') {
      currentDocUri = editor.document.uri.toString();
      currentPanel.title = `Preview: ${path.basename(editor.document.fileName)}`;
      updatePanel(editor.document);
    }
  });

  const themeSub = vscode.window.onDidChangeActiveColorTheme(() => {
    if (currentPanel && currentDocUri) {
      const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === currentDocUri);
      if (doc) updatePanel(doc);
    }
    vscode.commands.executeCommand('markdown.preview.refresh');
  });

  context.subscriptions.push(
    openCmd,
    changeSub,
    openDocSub,
    closeDocSub,
    editorSub,
    themeSub
  );

  // Synchronously return plugin hooks for VS Code's Markdown Preview
  return {
    extendMarkdownIt(md) {
      const defaultFence = md.renderer.rules.fence;

      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const info = (token.info || '').trim().toLowerCase();

        if (info === 'uml' || info === 'markuml') {
          try {
            const theme = getThemeName();
            const lang = getLanguage();
            const svg = renderSVG(token.content, { theme, lang });
            return `<div class="markuml-diagram" style="margin: 20px 0; display: flex; justify-content: center; overflow-x: auto;">${svg}</div>`;
          } catch (err) {
            return `<div class="markuml-error" style="color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 6px; padding: 12px; margin: 16px 0; font-family: monospace; font-size: 13px;">Error rendering MarkUML diagram: ${String(err.message || err)}</div>`;
          }
        }

        if (defaultFence) {
          return defaultFence(tokens, idx, options, env, self);
        }
        return self.renderToken(tokens, idx, options);
      };

      return md;
    },
  };
}

function deactivate() {}

module.exports = { activate, deactivate };

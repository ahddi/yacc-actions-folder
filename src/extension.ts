import * as vscode from "vscode";

// Decoration that hides curly braces content
const hideTextDecorationType = vscode.window.createTextEditorDecorationType({
  opacity: "0",
  letterSpacing: "-1000px",
});

// Decoration that shows {...} instead
const showDotsDecorationType = vscode.window.createTextEditorDecorationType({
  before: {
    contentText: "{...}",
    color: new vscode.ThemeColor("editorCodeLens.foreground"),
  },
});

// Map storing fold states for documents
const foldStates = new Map<string, boolean>();

export function activate(context: vscode.ExtensionContext) {
  let toggleCommand = vscode.commands.registerCommand(
    "yacc-action-folder.toggleFoldActions",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      // Vérifier que c'est un fichier Yacc
      if (editor.document.languageId !== "yacc") {
        vscode.window.showInformationMessage(
          "This command only works on Yacc files"
        );
        return;
      }

      const docUri = editor.document.uri.toString();
      const currentState = foldStates.get(docUri) || false;
      const newState = !currentState;

      foldStates.set(docUri, newState);

      if (newState) {
        applyFolding(editor);
      } else {
        clearFolding(editor);
      }
    }
  );

  // Reapplies decorations when editor changes
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        const docUri = editor.document.uri.toString();
        const isFolded = foldStates.get(docUri);

        if (isFolded) {
          applyFolding(editor);
        }
      }
    },
    null,
    context.subscriptions
  );

  // when text is edited, reapplies decorations
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document) {
        const docUri = editor.document.uri.toString();
        const isFolded = foldStates.get(docUri);

        if (isFolded) {
          // little timeout to leave time for vscode to update
          setTimeout(() => applyFolding(editor), 10);
        }
      }
    },
    null,
    context.subscriptions
  );

  // cleans state when the doc is closed
  vscode.workspace.onDidCloseTextDocument(
    (document) => {
      const docUri = document.uri.toString();
      foldStates.delete(docUri);
    },
    null,
    context.subscriptions
  );

  context.subscriptions.push(toggleCommand);
}

/**
 * Applies folding on all semantic actions
 */
function applyFolding(editor: vscode.TextEditor): void {
  const document = editor.document;
  const text = document.getText();

  const hideRanges: vscode.Range[] = [];
  const dotsRanges: vscode.Range[] = [];

  // A regex to find actions blocks {...}
  const regex = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const innerContent = match[1];

    // opening curly brace idx
    const openBracePos = document.positionAt(match.index);
    // closing curly brace idx
    const closeBracePos = document.positionAt(
      match.index + fullMatch.length - 1
    );

    if (innerContent.trim().length > 0) {
      // hides both the content AND the curly braces
      const contentStart = document.positionAt(match.index);
      const contentEnd = document.positionAt(
        match.index + fullMatch.length + 1
      );

      hideRanges.push(new vscode.Range(contentStart, contentEnd));

      dotsRanges.push(new vscode.Range(openBracePos, openBracePos));
    }
  }

  editor.setDecorations(hideTextDecorationType, hideRanges);
  editor.setDecorations(showDotsDecorationType, dotsRanges);

  if (hideRanges.length > 0) {
    vscode.window.setStatusBarMessage(
      `Folded ${hideRanges.length} action(s).`,
      3000
    );
  } else {
    vscode.window.showInformationMessage(
      "No semantic action found."
    );
  }
}

/**
 * Supprime toutes les décorations de pliage
 */
function clearFolding(editor: vscode.TextEditor): void {
  editor.setDecorations(hideTextDecorationType, []);
  editor.setDecorations(showDotsDecorationType, []);

  vscode.window.setStatusBarMessage('Unfolded all actions.', 3000);
}

export function deactivate() {
  foldStates.clear();
}

// history.js — pilha simples de desfazer/refazer baseada em comandos.
// Cada comando tem { undo(), redo() }. Push limpa a pilha de refazer.

export class History {
  constructor(limit = 200) {
    this.undoStack = [];
    this.redoStack = [];
    this.limit = limit;
  }

  push(command) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  undo() {
    const c = this.undoStack.pop();
    if (!c) return;
    c.undo();
    this.redoStack.push(c);
  }

  redo() {
    const c = this.redoStack.pop();
    if (!c) return;
    c.redo();
    this.undoStack.push(c);
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

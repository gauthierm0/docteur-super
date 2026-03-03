// TypeShuffle — adapted from https://github.com/codrops/TypeShuffleAnimation
// Plain JS port (no bundler). Requires the Splitting library as a global.
// Usage: const ts = new TypeShuffle(element); ts.trigger('fx5');

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

class Line {
  position = -1;
  cells = [];
  constructor(linePosition) {
    this.position = linePosition;
  }
}

class Cell {
  DOM = { el: null };
  position = -1;
  previousCellPosition = -1;
  original;
  state;
  color;
  originalColor;
  cache;

  constructor(DOM_el, { position, previousCellPosition } = {}) {
    this.DOM.el = DOM_el;
    this.original = this.DOM.el.innerHTML;
    this.state = this.original;
    this.color = this.originalColor =
      getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();
    this.position = position;
    this.previousCellPosition = previousCellPosition;
  }

  set(value) {
    this.state = value;
    this.DOM.el.innerHTML = this.state;
  }
}

class TypeShuffle {
  DOM = { el: null };
  lines = [];
  lettersAndSymbols = [
    'A','B','C','D','E','F','G','H','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
    '!','@','#','$','&','*','(',')','−','_','+','=','/',
    '[',']','{','}',';',':','<','>',',',
    '0','1','2','3','4','5','6','7','8','9',
  ];
  effects = {
    fx1: () => this.fx1(),
    fx2: () => this.fx2(),
    fx3: () => this.fx3(),
    fx4: () => this.fx4(),
    fx5: () => this.fx5(),
    fx6: () => this.fx6(),
  };
  totalChars = 0;
  isAnimating = false;

  constructor(DOM_el) {
    this.DOM.el = DOM_el;

    const results = Splitting({ target: this.DOM.el, by: 'lines' });
    results.forEach(s => Splitting({ target: s.words }));

    for (const [linePosition, lineArr] of results[0].lines.entries()) {
      const line = new Line(linePosition);
      let cells = [];
      let charCount = 0;
      for (const word of lineArr) {
        for (const char of [...word.querySelectorAll('.char')]) {
          cells.push(new Cell(char, {
            position: charCount,
            previousCellPosition: charCount === 0 ? -1 : charCount - 1,
          }));
          ++charCount;
        }
      }
      line.cells = cells;
      this.lines.push(line);
      this.totalChars += charCount;
    }

    // Freeze each char's width so swapping content never shifts the layout.
    // This lets text-align: right (or center) stay stable during animation.
    for (const line of this.lines) {
      for (const cell of line.cells) {
        const w = cell.DOM.el.getBoundingClientRect().width;
        cell.DOM.el.style.width  = w + 'px';
        cell.DOM.el.style.display = 'inline-block';
      }
    }
  }

  clearCells() {
    for (const line of this.lines) {
      for (const cell of line.cells) {
        cell.set('&nbsp;');
      }
    }
  }

  getRandomChar() {
    return this.lettersAndSymbols[Math.floor(Math.random() * this.lettersAndSymbols.length)];
  }

  fx5() {
    const MAX_CELL_ITERATIONS = 30;
    let finished = 0;
    this.clearCells();

    const loop = (line, cell, iteration = 0) => {
      cell.cache = { state: cell.state, color: cell.color };

      if (iteration === MAX_CELL_ITERATIONS - 1) {
        cell.color = cell.originalColor;
        cell.DOM.el.style.color = cell.color;
        cell.set(cell.original);
        ++finished;
        if (finished === this.totalChars) {
          this.isAnimating = false;
        }
      } else if (cell.position === 0) {
        cell.color = ['#3e775d', '#61dca3', '#61b3dc'][Math.floor(Math.random() * 3)];
        cell.DOM.el.style.color = cell.color;
        cell.set(
          iteration < 9
            ? ['*', '-', '\u0027', '\u0022'][Math.floor(Math.random() * 4)]
            : this.getRandomChar()
        );
      } else {
        cell.set(line.cells[cell.previousCellPosition].cache.state);
        cell.color = line.cells[cell.previousCellPosition].cache.color;
        cell.DOM.el.style.color = cell.color;
      }

      if (cell.cache.state !== '&nbsp;') {
        ++iteration;
      }

      if (iteration < MAX_CELL_ITERATIONS) {
        setTimeout(() => loop(line, cell, iteration), 23);
      }
    };

    for (const line of this.lines) {
      for (const cell of line.cells) {
        setTimeout(() => loop(line, cell), (line.position + 1) * 200);
      }
    }
  }

  // ── Other effects kept for completeness ──────────────────────
  fx1() {
    const MAX = 45; let finished = 0;
    this.clearCells();
    const loop = (line, cell, i = 0) => {
      cell.cache = cell.state;
      if (i === MAX - 1) { cell.set(cell.original); ++finished; if (finished === this.totalChars) this.isAnimating = false; }
      else if (cell.position === 0) { cell.set(i < 9 ? ['*','-','\u0027','\u0022'][Math.floor(Math.random()*4)] : this.getRandomChar()); }
      else { cell.set(line.cells[cell.previousCellPosition].cache); }
      if (cell.cache !== '&nbsp;') ++i;
      if (i < MAX) setTimeout(() => loop(line, cell, i), 15);
    };
    for (const line of this.lines) for (const cell of line.cells) setTimeout(() => loop(line, cell), (line.position+1)*200);
  }
  fx2() {
    const MAX = 20; let finished = 0;
    const loop = (line, cell, i = 0) => {
      if (i === MAX - 1) { cell.set(cell.original); cell.DOM.el.style.opacity = 0; setTimeout(() => { cell.DOM.el.style.opacity = 1; }, 300); ++finished; if (finished === this.totalChars) this.isAnimating = false; }
      else { cell.set(this.getRandomChar()); }
      ++i; if (i < MAX) setTimeout(() => loop(line, cell, i), 40);
    };
    for (const line of this.lines) for (const cell of line.cells) setTimeout(() => loop(line, cell), (cell.position+1)*30);
  }
  fx3() {
    const MAX = 10; let finished = 0;
    this.clearCells();
    const loop = (line, cell, i = 0) => {
      if (i === MAX - 1) { cell.set(cell.original); ++finished; if (finished === this.totalChars) this.isAnimating = false; }
      else { cell.set(this.getRandomChar()); }
      ++i; if (i < MAX) setTimeout(() => loop(line, cell, i), 80);
    };
    for (const line of this.lines) for (const cell of line.cells) setTimeout(() => loop(line, cell), randomNumber(0, 2000));
  }
  fx4() {
    const MAX = 30; let finished = 0;
    this.clearCells();
    const loop = (line, cell, i = 0) => {
      cell.cache = cell.state;
      if (i === MAX - 1) { cell.set(cell.original); ++finished; if (finished === this.totalChars) this.isAnimating = false; }
      else if (cell.position === 0) { cell.set(['*',':'][Math.floor(Math.random()*2)]); }
      else { cell.set(line.cells[cell.previousCellPosition].cache); }
      if (cell.cache !== '&nbsp;') ++i;
      if (i < MAX) setTimeout(() => loop(line, cell, i), 15);
    };
    for (const line of this.lines) for (const cell of line.cells) setTimeout(() => loop(line, cell), Math.abs(this.lines.length/2-line.position)*400);
  }
  fx6() {
    const MAX = 15; let finished = 0;
    const loop = (line, cell, i = 0) => {
      cell.cache = { state: cell.state, color: cell.color };
      if (i === MAX - 1) { cell.set(cell.original); cell.color = cell.originalColor; cell.DOM.el.style.color = cell.color; ++finished; if (finished === this.totalChars) this.isAnimating = false; }
      else { cell.set(this.getRandomChar()); cell.color = ['#2b4539','#61dca3','#61b3dc'][Math.floor(Math.random()*3)]; cell.DOM.el.style.color = cell.color; }
      ++i; if (i < MAX) setTimeout(() => loop(line, cell, i), randomNumber(20, 60));
    };
    for (const line of this.lines) for (const cell of line.cells) setTimeout(() => loop(line, cell), (line.position+1)*80);
  }

  trigger(effect = 'fx1') {
    if (!(effect in this.effects) || this.isAnimating) return;
    this.isAnimating = true;
    this.effects[effect]();
  }
}

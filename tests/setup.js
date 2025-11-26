// Global stubs so Chart.js and canvas calls don't break under Jest/jsdom.
class ChartStub {
    constructor() {}
    destroy() {}
    update() {}
}

global.Chart = ChartStub;

// Force canvas to return a harmless context object.
HTMLCanvasElement.prototype.getContext = () => ({
    canvas: { id: 'mock' },
    clearRect() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
});

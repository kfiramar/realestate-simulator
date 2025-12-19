importScripts('logic.js');
self.onmessage = (e) => self.postMessage(self.Logic.searchSweetSpots(e.data));

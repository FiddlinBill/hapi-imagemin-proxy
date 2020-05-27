'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Sinon = require('sinon');
const proxyquire = require('proxyquire');

// Test shortcuts
const lab = (exports.lab = Lab.script());
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;
// Test stubs
/* eslint-disable brace-style */
const Catbox = {
    Client: function (engine) {
        this.engine = engine;
    }
};
Catbox.Client.prototype = {
    get: Sinon.stub(),
    set: Sinon.stub(),
    start: Sinon.stub()
};
/* eslint-enable brace-style */

const ImageCache = proxyquire('../lib/image-cache.js', {
    '@hapi/catbox': Catbox,
    '@hapi/catbox-memory': { foo: 'catbox-memory' }
});

describe('Image Cache', () => {
    describe('constructor', () => {
        it('should use "catbox-memory" if no engine is specified', () => {
            const imageCache = new ImageCache();
            expect(imageCache._cache.engine.foo).to.equal('catbox-memory');
        });

        it('should have a ttl of one hour if `options.expiresIn` is not given', () => {
            const imageCache = new ImageCache();
            expect(imageCache._ttl).to.equal(3600000);
        });

        it('should set a ttl based on `options.expiresIn`', () => {
            const imageCache = new ImageCache(null, { expiresIn: 60000 });
            expect(imageCache._ttl).to.equal(60000);
        });
    });

    describe('get', () => {
        it('should resolve on success', async () => {
            const imageCache = new ImageCache();
            imageCache._cache.get.resolves({ item: 'data' });
            const data = await imageCache.get('filename');
            expect(data).to.equal('data');
        });

        it('should reject on error', () => {
            const imageCache = new ImageCache();
            imageCache._cache.get.rejects(new Error('get'));
            imageCache.get('filename').catch(err => {
                expect(err).to.be.an.error(Error, 'get');
            });
        });
    });

    describe('set', () => {
        it('should resolve on success', async () => {
            const imageCache = new ImageCache();
            imageCache._cache.set.resolves(null);
            const data = await imageCache.set('filename', 'data');
            expect(data).to.equal('data');
        });

        it('should reject on error', () => {
            const imageCache = new ImageCache();
            imageCache._cache.set.rejects(new Error('set'));
            imageCache.set().catch(err => {
                expect(err).to.be.an.error(Error, 'set');
            });
        });
    });

    describe('start', () => {
        it('should start the caching engine', () => {
            const imageCache = new ImageCache();
            imageCache._cache.start.resolves(null);
            imageCache.start().then(() => {
                expect(true).to.be.true();
            });
        });

        it('should reject on error', () => {
            const imageCache = new ImageCache();
            imageCache._cache.start.rejects(new Error('start'));
            imageCache.start().catch(err => {
                expect(err).to.be.an.error(Error, 'start');
            });
        });
    });
});

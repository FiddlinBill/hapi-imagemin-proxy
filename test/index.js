'use strict';

const Hapi = require('@hapi/hapi');
const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Boom = require('@hapi/boom');
const Sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

// Test shortcuts
const lab = (exports.lab = Lab.script());
const expect = Code.expect;
const before = lab.before;
const after = lab.after;
const describe = lab.describe;
const it = lab.it;

// Test stubs
const jpeg = Buffer.from(new Uint8Array([0xff, 0xd8]));
const imageOptimizer = {
    get: Sinon.stub(),
    fullPath: Sinon.stub(),
    optimize: Sinon.stub()
};
const imageCache = {
    get: Sinon.stub(),
    set: Sinon.stub(),
    start: Sinon.stub()
};
const ImageCache = function () {};
ImageCache.prototype = imageCache;

const plugin = proxyquire('../lib/index.js', {
    './image-optimizer.js': imageOptimizer,
    './image-cache.js': ImageCache
});

describe('hapi-imagemin-proxy', () => {
    const server = new Hapi.Server({
        //        debug: { request: ['error'] },
        port: 5678
    });

    before(async () => {
        imageCache.start.returns(Promise.resolve());
        await server.register({ plugin, options: { source: __dirname } });
    });

    after(async () => {
        await server.stop({ timeout: 0 });
    });

    it('is running', () => {
        expect(new Date(server.info.started)).to.be.a.date();
    });

    it('should respond with HTTP 404 if no matching file name was provided in URL', async () => {
        const res = await server.inject('/');
        expect(res.statusCode).to.equal(404);
    });

    it('should respond with cached image data on cache hit', async () => {
        imageCache.get.resolves(jpeg);

        const res = await server.inject('/imagename.jpg');
        expect(res.rawPayload).to.only.include(jpeg);
        expect(res.statusCode).to.equal(200);
    });

    it('should load the image file on cache miss', async () => {
        imageCache.get.resolves();
        imageCache.set.resolves(jpeg);
        imageOptimizer.get.resolves();

        const res = await server.inject('/imagename.jpg');
        expect(res.rawPayload).to.only.include(jpeg);
        expect(res.statusCode).to.equal(200);
    });

    it('should return HTTP 404 if image file could not be loaded', async () => {
        const err = Boom.boomify(
            new Error('ENOENT: no such file or directory'),
            { statusCode: 404 }
        );
        imageCache.get.rejects(err);

        const res = await server.inject('/imagename.jpg');
        expect(res.statusCode).to.equal(404);
        expect(JSON.parse(res.payload).message).to.equal('Not Found');
    });

    it('should return HTTP 500 on error', async () => {
        const err = Boom.boomify(new Error(), 500);
        imageCache.get.returns(Promise.reject(err));

        const res = await server.inject('/imagename.jpg');
        expect(res.statusCode).to.equal(500);
        expect(JSON.parse(res.payload).message).to.equal(
            'An internal server error occurred'
        );
    });
});

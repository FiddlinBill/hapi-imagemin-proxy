'use strict';

const ms = require('ms');
const Catbox = require('@hapi/catbox');
const Package = require('../package.json');

const internals = {};

internals.getKey = filename => ({
    id: filename,
    segment: Package.name
});

const ImageCache = (module.exports = function (engine, options = {}) {
    engine = engine || require('@hapi/catbox-memory');
    this._ttl = options.expiresIn || ms('1h');
    this._cache = new Catbox.Client(engine, options);
});

ImageCache.prototype.get = async function (filename) {
    const key = internals.getKey(filename);

    const cached = await this._cache.get(key);
    return cached && cached.item ? cached.item : null;
};

ImageCache.prototype.set = async function (filename, data) {
    const key = internals.getKey(filename);
    await this._cache.set(key, data, this._ttl);
    return data;
};

ImageCache.prototype.start = function () {
    return this._cache.start();
};

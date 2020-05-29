'use strict';

const Fs = require('fs').promises;
const Url = require('url');
const Path = require('path');
const Boom = require('@hapi/boom');
const Wreck = require('@hapi/wreck');
const Hoek = require('@hapi/hoek');
const promisePipe = require('promise.pipe');

// Default optimization plugins
const ImageminGm = require('imagemin-gm');
const imageminGm = new ImageminGm();
const imageminJpegoptim = require('imagemin-jpegoptim');
const imageminPngquant = require('imagemin-pngquant');
const imageminGifsicle = require('imagemin-gifsicle');
const imageminSvgo = require('imagemin-svgo');

const internals = {
    defaults: {
        plugins: [
            imageminJpegoptim({ progressive: true, max: 75 }),
            imageminPngquant(),
            imageminGifsicle({ optimizationLevel: 3 }),
            imageminSvgo()
        ]
    }
};

internals.isLocal = path => !/^https?:\/\//.test(path);

exports.fullPath = (basePath, filename) => {
    if (internals.isLocal(basePath)) {
        return Path.join(basePath, filename);
    }

    const parsed = Url.parse(basePath);
    const path = Path.join(parsed.path, filename);
    const auth = parsed.auth ? `${parsed.auth}@` : '';

    return `${parsed.protocol}//${auth}${parsed.host}${path}`;
};

/* eslint-disable */
exports.get = async (image, wreckOptions) => {
    if (internals.isLocal(image)) {
        try {
            const payload = await Fs.readFile(image);
            return payload;
        } catch (err) {
            console.log(err);
            throw Boom.boomify(err, err.code === "ENOENT" ? 404 : 500);
        }
    }

    const { res, payload } = await Wreck.get(image, wreckOptions);
    if (res.statusCode !== 200) {
        throw new Boom.Boom(res.statusCode, image);
    }
    return payload;
};

/* eslint-enable */

exports.optimize = (input, options) => {
    const opts = Hoek.applyToDefaults(internals.defaults, options);

    if (opts.format) {
        opts.plugins.unshift(imageminGm.convert(opts.format));
    }

    if (opts.width || opts.height) {
        opts.plugins.unshift(
            imageminGm.resize({
                width: opts.width,
                height: opts.height,
                gravity: 'Center'
            })
        );
    }

    return opts.plugins.length > 0
        ? promisePipe(opts.plugins)(input)
        : Promise.resolve(input);
};

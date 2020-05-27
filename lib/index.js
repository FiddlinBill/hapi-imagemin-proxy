'use strict';

const Path = require('path');
const Hoek = require('@hapi/hoek');
const Boom = require('@hapi/boom');
const XRegExp = require('xregexp');
const ImageCache = require('./image-cache.js');
const ImageOptimizer = require('./image-optimizer.js');

const internals = {};

internals.pathPattern = XRegExp(
    `^
        (?<filename>.+?(?:jpe?g|gif|png|svg))  # File name
        (?:,w(?<width>\\d{1,4})(?=,|$))?       # Width
        (?:,h(?<height>\\d{1,4})(?=,|$))?      # Height
        (?:,(?<format>jpe?g|gif|png|svg))?     # Output format
    $`,
    'x'
);

const register = async function (server, options) {
    const mime = server.mime._byExtension;

    Hoek.assert(
        options.source,
        'Missing image source directory: `options.source`'
    );

    const config = options.imagecache || {};
    const imageCache = new ImageCache(config.engine, config.options);

    server.route({
        method: 'GET',
        path: '/{param*}',
        config: {
            cache: options.cache
        },
        handler: function (request, h) {
            const parsedPath = XRegExp.exec(
                request.path,
                internals.pathPattern
            );

            if (!parsedPath) {
                throw Boom.notFound();
            }

            const originalFormat = Path.extname(parsedPath.filename).slice(1);
            const imageOptions = {
                width: parsedPath.width,
                height: parsedPath.height,
                format: parsedPath.format
            };

            return imageCache
                .get(request.path)
                .then(imageData => {
                    if (imageData) {
                        return imageData;
                    }
                    server.log(['debug'], `cache miss: ${request.path}`);
                    return ImageOptimizer.get(
                        ImageOptimizer.fullPath(
                            options.source,
                            parsedPath.filename
                        ),
                        options.wreck
                    )
                        .then(imageData =>
                            ImageOptimizer.optimize(imageData, imageOptions)
                        )
                        .then(imageData =>
                            imageCache.set(request.path, imageData)
                        );
                })
                .then(imageData => {
                    server.log(['debug'], `cache hit: ${request.path}`);

                    const type =
                        mime[imageOptions.format || originalFormat].type;
                    return h.response(imageData).type(type);
                })
                .catch(err => {
                    request.log(['error'], err);
                    // Reply with matching error code but don't leak details
                    throw new Boom.Boom(
                        Hoek.reach(err, 'output.payload.error'),
                        {
                            statusCode: Hoek.reach(err, 'output.statusCode')
                        }
                    );
                });
        }
    });

    await imageCache.start();
};

exports.plugin = {
    pkg: require('../package.json'),
    register
};

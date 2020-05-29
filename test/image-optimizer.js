'use strict';

const Path = require('path');
const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

// Test shortcuts
const lab = (exports.lab = Lab.script());
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;

// Test stubs
/* eslint-disable brace-style */
const jpeg = Buffer.from(new Uint8Array([0xff, 0xd8]));
const imageminGmStub = Sinon.stub().callsFake(() => {
    return {
        convert: Sinon.stub().returns(() => {
            Promise.resolve(jpeg);
        }),
        resize: Sinon.stub().returns(() => {
            Promise.resolve(jpeg);
        })
    };
});
const imageOptimizer = proxyquire('../lib/image-optimizer.js', {
    'imagemin-gm': imageminGmStub
});
/* eslint-enable brace-style */
describe('Image Optimizer', () => {
    lab.afterEach(() => {
        Sinon.restore();
    });
    describe('fullPath', () => {
        it('should return a valid path for local files', () => {
            expect(imageOptimizer.fullPath('/foo/bar', '/baz.jpg')).to.equal(
                '/foo/bar/baz.jpg'
            );
            expect(imageOptimizer.fullPath('/foo/bar/', '/baz.jpg')).to.equal(
                '/foo/bar/baz.jpg'
            );
        });

        it('should return a valid URL for remote files', () => {
            expect(
                imageOptimizer.fullPath('http://foo.bar', '/baz.jpg')
            ).to.equal('http://foo.bar/baz.jpg');
            expect(
                imageOptimizer.fullPath('http://foo.bar/baz', 'zing/zang.jpg')
            ).to.equal('http://foo.bar/baz/zing/zang.jpg');
            expect(
                imageOptimizer.fullPath(
                    'http://basic:auth@foo.bar/',
                    '/baz.jpg'
                )
            ).to.equal('http://basic:auth@foo.bar/baz.jpg');
        });
    });

    describe('get', () => {
        it('should load a local file and return its content', () => {
            imageOptimizer
                .get(Path.join(process.cwd(), '.gitignore'))
                .then(content => {
                    expect(content).to.exist();
                });
        });

        it('should reject if the local file could not be loaded', () => {
            imageOptimizer.get('nonexistantfile').catch(err => {
                expect(err).to.be.an.error();
            });
        });

        it('should GET a remote file and return its content', () => {
            imageOptimizer.get('http://example.com/').then(content => {
                expect(content).to.exist();
            });
        });

        it('should reject if the remote file could not be loaded', async () => {
            await imageOptimizer
                .get('http://nonexistantdomainna.me')
                .catch(err => {
                    expect(err).to.be.an.error();
                });
        });
    });

    describe('optimize', () => {
        /* eslint-disable brace-style */
        it('should convert image formats', () => {
            imageOptimizer.optimize(jpeg, { format: 'png', plugins: [] });
            expect(
                imageminGmStub.firstCall.returnValue.convert.calledOnce
            ).to.be.true();
        });

        it('should resize the image', () => {
            imageOptimizer.optimize(jpeg, { width: 100, plugins: [] });
            expect(
                imageminGmStub.firstCall.returnValue.resize.calledOnce
            ).to.be.true();
        });

        it('should pass the original buffer if no plugins were given', async () => {
            const result = await imageOptimizer.optimize(jpeg, { plugins: [] });
            expect(result).to.equal(jpeg);
        });
    });
});

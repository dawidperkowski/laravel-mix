let path = require('path');
let fs = require('fs');
let spawn = require('child_process').spawn;
let notifier = require('node-notifier');

class StandaloneSass {
    /**
     * Create a new StandaloneSass instance.
     *
     * @param {string} src
     * @param {string} output
     * @param {object} pluginOptions
     */
    constructor(src, output, pluginOptions) {
        this.src = src;
        this.output = output;
        this.pluginOptions = pluginOptions;
        this.shouldWatch = process.argv.includes('--watch');
        this.successCount = 0;

        Mix.addAsset(this.output);
    }

    /**
     * Run the node-sass compiler.
     */
    run() {
        this.compile();

        if (this.shouldWatch) this.watch();
    }

    /**
     * Compile Sass.
     *
     * @param {Boolean} watch
     */
    compile(watch = false) {
        const autoprefixerEnabled = Config.autoprefixer.enabled;
        const output = autoprefixerEnabled ? `${this.output.path()}.dist` : this.output.path();

        this.command = spawn(
            path.resolve('./node_modules/.bin/node-sass'),
            [this.src.path(), output].concat(this.options(watch)),
            {shell: true}
        );

        this.whenOutputIsAvailable((output, event) => {
            if (event === 'error') this.onFail(output);
            if (event === 'success') {
                if (autoprefixerEnabled) {
                    this.runPostcss(watch);
                } else {
                    this.onSuccess(output);
                }
            }
        });

        return this;
    }

    /**
     * Fetch the node-sass options.
     *
     * @param {Boolean} watch
     */
    options(watch) {
        let sassOptions = [
            '--precision=8',
            '--output-style=' + (Mix.inProduction() ? 'compressed' : 'expanded')
        ];

        if (watch) sassOptions.push('--watch');

        if (this.pluginOptions.includePaths) {
            this.pluginOptions.includePaths.forEach(path =>
                sassOptions.push('--include-path=' + path)
            );
        }

        if (this.pluginOptions.importer) {
            sassOptions.push('--importer ' + this.pluginOptions.importer);
        }

        if (Mix.isUsing('sourcemaps') && !Mix.inProduction()) {
            sassOptions.push('--source-map-embed');
        }

        return sassOptions;
    }

    removeDistFile() {
        fs.unlink(`${this.output.path()}.dist`, () => null);
    }

    runPostcss(watch = false) {
        this.postcssCommand = spawn(
            path.resolve('./node_modules/.bin/postcss'),
            this.postcssOptions(watch),
            {shell: true}
        );

        this.postcssCommand.on('exit', () => {
            this.removeDistFile();
        });

        this.whenPostcssOutputIsAvailable((output, event) => {
            if (event === 'error') this.onFail(output);
            if (event === 'success') this.onSuccess(output);
        });

        return this;
    }

    postcssOptions(watch) {
        const options = [
            `${this.output.path()}.dist`,
            `-o ${this.output.path()}`,
            `--config ${path.resolve('./postcss.config.js')}`,
            '--verbose'
        ];

        if (watch) options.push('--watch --poll');

        return options;
    }

    /**
     * Compile Sass, while registering a watcher.
     */
    watch() {
        return this.compile(true);
    }

    /**
     * Register a callback for when output is available.
     *
     * @param {Function} callback
     */
    whenOutputIsAvailable(callback) {
        this.command.stdout.on('data', output => {
            output = output.toString();

            let event = 'change';
            // if (output.includes('Error')) event = 'error';
            if (output.includes('Wrote CSS')) {
                event = 'success';
                output = '';
            }

            callback(output, event);
        });

        this.command.stderr.on('data', output => {
            output = output.toString();

            let event = 'change';
            if (output.includes('Error')) event = 'error';
            if (output.includes('Wrote CSS')) {
                event = 'success';
                output = '';
            }

            callback(output, event);
        });
    }

    /**
     * Register a callback for when output is available.
     *
     * @param {Function} callback
     */
    whenPostcssOutputIsAvailable(callback) {
        this.postcssCommand.stdout.on('data', output => {
            output = output.toString();

            let event = 'change';
            if (output.includes('Error')) event = 'error';
            if (output.includes('Finished')) {
                event = 'success';
                output = '';
            }

            callback(output, event);
        });

        this.postcssCommand.stderr.on('data', output => {
            output = output.toString();

            let event = 'change';
            if (output.includes('Error')) event = 'error';
            if (output.includes('Finished')) {
                event = 'success';
                output = '';
            }

            callback(output, event);
        });
    }

    /**
     * Handle successful compilation.
     *
     * @param {string} output
     */
    onSuccess(output) {
        if (output && output.length > 0) {
            console.log('\n');
            console.log(output);
        }

        this.successCount++;

        if (Config.notifications.onSuccess && this.successCount > 1) {
            notifier.notify({
                title: 'Laravel Mix',
                message: 'Sass Compilation Successful',
                contentImage: 'node_modules/laravel-mix/icons/laravel.png'
            });
        }
    }

    /**
     * Handle failed compilation.
     *
     * @param {string} output
     */
    onFail(output) {
        output = output.replace(
            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
            ''
        );

        let parsedOutput = {message: 'Unknown error'};

        try {
            parsedOutput = JSON.parse(output);

        } catch (e) {

        }

        console.log('\n');
        console.error(`Sass Compilation Failed! [${parsedOutput.status}]`);
        console.log(`File ${parsedOutput.file} [${parsedOutput.line}:${parsedOutput.column}]`);
        console.log(`${parsedOutput.message}`);
        console.log(`${parsedOutput.formatted}`);

        if (Mix.isUsing('notifications')) {
            notifier.notify({
                title: 'Laravel Mix',
                subtitle: 'Sass Compilation Failed',
                message: parsedOutput.message,
                contentImage: 'node_modules/laravel-mix/icons/laravel.png'
            });
        }

        if (!this.shouldWatch) process.exit();
    }
}

module.exports = StandaloneSass;

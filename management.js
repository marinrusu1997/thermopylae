"use strict";

const execa = require('execa');
const { DepGraph } = require('dependency-graph');

function overallOrder() {
    const stdout = execa.sync('yarn', ['workspaces', 'info', '--json']).stdout.split("\n")
    stdout.splice(0,1);
    stdout.splice(stdout.length - 1,1);

    const pacakges = JSON.parse(stdout.join("\n"));

    const graph = new DepGraph({ circular: true });
    Object.keys(pacakges).forEach(pkg => graph.addNode(pkg));

    for (const pkg of Object.keys(pacakges)) {
        for (const dep of pacakges[pkg].workspaceDependencies) {
            graph.addDependency(pkg, dep);
        }
    }

    return graph.overallOrder();
}

function run(command) {
    const order = overallOrder();
    for (let i = 0; i < order.length; i++) {
        try {
            console.log('> ', order[i], `${i+1}/${order.length}`);
            execa.sync('yarn', ['workspace', order[i], 'run', command], {stdio: 'inherit'});
        } catch (e) {
            console.error(e);
        }
    }
}

console.log(overallOrder().map(pkg => `-> ${pkg}`).join('\n'));
//run('purge');
const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, 'packages');
const getPackagePaths = () => fs.readdirSync(PACKAGES_DIR).filter((pkg) => fs.existsSync(path.join(PACKAGES_DIR, pkg, 'tsconfig.json')));

const getPackageName = (pkgPath) => {
	const pkgJson = require(path.join(PACKAGES_DIR, pkgPath, 'package.json'));
	return pkgJson.name;
};

const packagePaths = getPackagePaths();
const packageMap = new Map(packagePaths.map((pkg) => [getPackageName(pkg), pkg]));

// Update each package’s tsconfig
for (const pkg of packagePaths) {
	const pkgTsconfigPath = path.join(PACKAGES_DIR, pkg, 'tsconfig.json');
	const pkgTsconfig = JSON.parse(fs.readFileSync(pkgTsconfigPath, 'utf8'));

	const pkgJson = require(path.join(PACKAGES_DIR, pkg, 'package.json'));
	const deps = Object.assign({}, pkgJson.dependencies, pkgJson.devDependencies);

	const references = Object.keys(deps)
		.filter((depName) => packageMap.has(depName))
		.map((depName) => ({
			path: path.relative(path.join(PACKAGES_DIR, pkg), path.join(PACKAGES_DIR, packageMap.get(depName))).replaceAll('\\', `/`)
		}));

	pkgTsconfig.references = references;

	fs.writeFileSync(pkgTsconfigPath, JSON.stringify(pkgTsconfig, null, 2));
	console.log(`Updated tsconfig.json for ${pkg}`);
}

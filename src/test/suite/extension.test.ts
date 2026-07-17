import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

suite('LPG VS Code extension smoke', () => {
	test('extension activates for lpg language', async () => {
		const ext = vscode.extensions.getExtension('kuafuwang.lpg-vscode');
		assert.ok(ext, 'kuafuwang.lpg-vscode should be installed in the test host');
		await ext!.activate();
		assert.strictEqual(ext!.isActive, true);
	});

	test('package.json declares .g / .lpg language contribution', () => {
		const pkgPath = path.join(__dirname, '..', '..', '..', 'package.json');
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
		const langs = pkg.contributes?.languages ?? [];
		const lpg = langs.find((l: { id: string }) => l.id === 'lpg');
		assert.ok(lpg, 'lpg language contribution missing');
		assert.ok(lpg.extensions.includes('.g'));
		assert.ok(lpg.extensions.includes('.lpg'));
	});

	test('assembled templates directory is present when packaging', () => {
		// Optional in pure compile CI; required after assemble-release.sh.
		const templates = path.join(__dirname, '..', '..', '..', 'templates', 'templates');
		if (!fs.existsSync(templates)) {
			// Soft-skip: compile-only jobs may not assemble.
			return;
		}
		assert.ok(fs.statSync(templates).isDirectory());
	});
});

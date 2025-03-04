import * as vscode from "vscode";
import fs = require("node:fs");
import path = require("node:path");

export async function activate(context: vscode.ExtensionContext) {
	const workspaceRoot = vscode.workspace.workspaceFolders
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: undefined;

	const packageJSonContents =
		JSON.parse(fs.readFileSync(`${workspaceRoot}/package.json`, "utf-8")) ||
		undefined;

	const filesByPackageManager: {
		[key in "npm" | "yarn" | "pnpm" | "bun"]: string;
	} = {
		npm: "package-lock.json",
		yarn: "yarn.lock",
		pnpm: "pnpm-lock.yaml",
		bun: "bun.lock",
	};

	for (const manager of [
		"package.json",
		...Object.values(filesByPackageManager),
	]) {
		const ManagerWatcher = vscode.workspace.createFileSystemWatcher(
			`**/${manager}`,
		);
		ManagerWatcher.onDidChange(() => {
			// vscode.window.showInformationMessage(`${manager} has been changed.`);
			deactivate(context);
			activate(context);
		});
		ManagerWatcher.onDidCreate(() => {
			// vscode.window.showInformationMessage(`${manager} has been created.`);
			deactivate(context);
			activate(context);
		});
		ManagerWatcher.onDidDelete(() => {
			// custom context is set to filter commands in the command palette menu
			setCustomContext(null, null);
			// vscode.window.showInformationMessage(`${manager} has been deleted.`);
			deactivate(context);
			activate(context);
		});
		context.subscriptions.push(ManagerWatcher);
	}

	let errorMessage: string;

	const packageManagerUsed = getPackageManager(
		workspaceRoot as string,
		filesByPackageManager,
	)?.command;

	const canProceed = (packageManagerUsed: string | undefined) => {
		errorMessage = "Not a Qwik Project";
		const packageJSonContents =
			JSON.parse(fs.readFileSync(`${workspaceRoot}/package.json`, "utf-8")) ||
			undefined;
		const isQwik =
			packageJSonContents?.devDependencies?.["@qwik.dev/router"] ||
			packageJSonContents?.devDependencies?.["@builder.io/qwik-city"];

		if (!packageManagerUsed) {
			// vscode.window.showErrorMessage("Package Manager not found");
			errorMessage = "Package Manager not found";
		}

		return Boolean(workspaceRoot && isQwik && packageManagerUsed);
	};

	const canProceedActivation = canProceed(packageManagerUsed);

	const currentQwikAstroCanProceed = () => {
		errorMessage = "Not a Qwik Astro Project";
		const packageJSonContents =
			JSON.parse(fs.readFileSync(`${workspaceRoot}/package.json`, "utf-8")) ||
			undefined;

		const isQwikAstro =
			packageJSonContents?.dependencies?.["@qwikdev/astro"] &&
			packageJSonContents?.dependencies?.astro;

		const packageManagerUsed = getPackageManager(
			workspaceRoot as string,
			filesByPackageManager,
		)?.command;

		if (!packageManagerUsed) {
			errorMessage = "Package Manager not found";
		}
		return Boolean(workspaceRoot && isQwikAstro && packageManagerUsed);
	};
	const canProceedAstroActivation = currentQwikAstroCanProceed();

	const isQwik = canProceedActivation;
	const isQwikAstro = canProceedAstroActivation;

	// custom context is set to filter commands in the command palette menu

	setCustomContext(isQwik, isQwikAstro);

	const addTsxRouteCommand = vscode.commands.registerCommand(
		"qwik-shortcuts.addTsxRoute",
		async () => {
			// error handling
			// if these are not here, the extension will crash, and won't show the error messages
			// this is because context.subscriptions.push(addTsxRouteCommand); will not be called
			canProceedActivation
				? await addRoute(packageManagerUsed as string)
				: vscode.window.showErrorMessage(errorMessage);
		},
	);
	context.subscriptions.push(addTsxRouteCommand);

	const addMDXRouteCommand = vscode.commands.registerCommand(
		"qwik-shortcuts.addMDXRoute",
		async () => {
			canProceedActivation
				? await addRoute(packageManagerUsed as string, ".mdx")
				: vscode.window.showErrorMessage(errorMessage);
		},
	);
	context.subscriptions.push(addMDXRouteCommand);

	const addMDRouteCommand = vscode.commands.registerCommand(
		"qwik-shortcuts.addMDRoute",
		async () => {
			canProceedActivation
				? await addRoute(packageManagerUsed as string, ".md")
				: vscode.window.showErrorMessage(errorMessage);
		},
	);
	context.subscriptions.push(addMDRouteCommand);

	const addCreateComponentCommand = vscode.commands.registerCommand(
		"qwik-shortcuts.createComponent",
		async () => {
			canProceedActivation
				? await addComponent(packageManagerUsed as string)
				: vscode.window.showErrorMessage(errorMessage);
		},
	);
	context.subscriptions.push(addCreateComponentCommand);

	const addIntegration = vscode.commands.registerCommand(
		"qwik-shortcuts.addIntegration",
		() => {
			canProceedActivation
				? addQwikIntegration(packageManagerUsed as string)
				: vscode.window.showErrorMessage(errorMessage);
		},
	);
	context.subscriptions.push(addIntegration);

	const addCreateQwikAstroJSXComponentCommand = vscode.commands.registerCommand(
		"qwik-shortcuts.addCreateQwikAstroJSXComponentCommand",
		async () => {
			canProceedAstroActivation
				? await addQwikAstroComponent(
						context,
						"jsx",
						packageJSonContents as JSON,
					)
				: vscode.window.showErrorMessage(errorMessage);
		},
	);

	context.subscriptions.push(addCreateQwikAstroJSXComponentCommand);

	const addCreateQwikAstroTSXComponentCommand = vscode.commands.registerCommand(
		"qwik-shortcuts.addCreateQwikAstroTSXComponentCommand",
		async () => {
			canProceedAstroActivation
				? await addQwikAstroComponent(context, "tsx", packageJSonContents)
				: vscode.window.showErrorMessage(errorMessage);
		},
	);

	context.subscriptions.push(addCreateQwikAstroTSXComponentCommand);

	const addCreateAstroRouteComponentCommand = vscode.commands.registerCommand(
		"qwik-shortcuts.addCreateAstroRouteComponentCommand",
		async () => {
			canProceedAstroActivation
				? await addAstroRoute(context, "route", packageJSonContents)
				: vscode.window.showErrorMessage(errorMessage);
		},
	);

	context.subscriptions.push(addCreateAstroRouteComponentCommand);

	const url = () => {
		const packageJSonContents =
			JSON.parse(fs.readFileSync(`${workspaceRoot}/package.json`, "utf-8")) ||
			undefined;

		let url = "https://qwikui.com/";
		if (
			packageJSonContents.devDependencies?.["@qwik-ui/headless"] ||
			packageJSonContents.dependencies?.["@qwik-ui/headless"]
		) {
			url = "https://qwikui.com/docs/headless/introduction/";
		}
		if (
			packageJSonContents.devDependencies?.["@qwik-ui/styled"] ||
			packageJSonContents.dependencies?.["@qwik-ui/styled"]
		) {
			url = "https://qwikui.com/docs/styled/introduction/";
		}

		return url;
	};
	const addQwikUI = vscode.commands.registerCommand(
		"qwik-shortcuts.addQwikUI",
		async () => {
			addQwikUIComponent(url());
		},
	);

	context.subscriptions.push(addQwikUI);
	const addQwikDocs = vscode.commands.registerCommand(
		"qwik-shortcuts.addQwikDocs",
		async () => {
			let url = "https://qwik.dev/docs/";
			if (vscode.window.activeTextEditor) {
				const activeTextEditor = vscode.window.activeTextEditor;
				const selection = activeTextEditor.selection;
				const selectedText =
					activeTextEditor.document.getText(selection) || undefined;
				if (selectedText) {
					const transformedText = transformSelectedText(selectedText);
					if (transformedText) {
						url = getDocsUrl(transformedText, docsObject);
					}
				}
			}
			openWebPanelDocs(url as string);
		},
	);

	context.subscriptions.push(addQwikDocs);
}

// This method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {
	// clear all subscriptions so that when the files change it activates the extension again
	for (let index = 0; index < context.subscriptions.length; index++) {
		const element = context.subscriptions[index];
		element.dispose();
	}
}

interface PackageManager {
	command: string;
}

function getPackageManager(
	workspaceRoot: string,
	filesByPackageManager: object,
): PackageManager | undefined {
	for (const packageManager in filesByPackageManager) {
		const filePath = path.join(
			workspaceRoot,
			filesByPackageManager[
				packageManager as keyof typeof filesByPackageManager
			],
		);
		if (fs.existsSync(filePath)) {
			return { command: packageManager };
		}
	}
	return;
}

async function addRoute(packageManager: string, fileExtension?: string) {
	const input = await vscode.window.showInputBox({
		prompt: "What is the name of the route?",
		placeHolder: "product/[id]",
		validateInput: (value: string): string | null => {
			if (!value) {
				return "Route name cannot be empty";
			}
			// return empty string for valid input
			return "";
		},
	});
	if (input) {
		const transformedInput = transformInput(input);
		const terminal = vscode.window.createTerminal("Qwik Shortcuts");
		terminal.sendText(
			`${packageManager} run qwik new /${transformedInput}${
				fileExtension ? `${fileExtension}` : ""
			}`,
		);
		terminal.show();
	} else {
		vscode.window.showErrorMessage("No Route Details Entered.");
	}
}

async function addComponent(packageManager: string) {
	const input = await vscode.window.showInputBox({
		prompt: "What is the name of the component?",
		placeHolder: "my-component",
		validateInput: (value: string): string | null => {
			if (!value) {
				return "Component name cannot be empty";
			}
			if (value.includes("/")) {
				return "Component name cannot contain '/'";
			}
			// return empty string for valid input
			return "";
		},
	});
	if (input) {
		const transformedInput = transformInput(input);
		const terminal = vscode.window.createTerminal("Qwik Shortcuts");

		terminal.sendText(`${packageManager} run qwik new ${transformedInput}`);
		terminal.show();
	} else {
		vscode.window.showErrorMessage("No Component Details Entered.");
	}
}

/**
 * Transforms the input string by trimming, converting to lowercase, and replacing spaces with hyphens.
 * The regex is to find all occurrences of text within parentheses and wraps them in double quotes.
 * The reason for this is that () causes an error in the terminal, and will not work without the quotes.
 *
 * @param {string} input - The input string to be transformed.
 * @returns {string} - The transformed string.
 *
 * Example:
 * transformInput((admin)/profile))
 * // returns "(admin)"/profile
 *
 * Example Command to give an idea of why:
 * pnpm run qwik new /"(admin)"/profile
 */

function transformInput(input: string): string {
	let updatedInput = input.trim().toLowerCase().replace(/ /g, "-");

	// adds support for grouped layouts
	// e.g. (admin) -> "(admin)"
	//
	const regex = /\([a-zA-Z]+\)/g;
	const matches = input.match(regex);
	// replace all file extensions
	const extensions = [".mdx", ".md", ".tsx", ".ts", ".js", ".jsx", "index"];
	for (let index = 0; index < extensions.length; index++) {
		const element = extensions[index];
		updatedInput = updatedInput.replaceAll(element, "");
	}

	if (!matches) {
		return updatedInput;
	}
	for (let index = 0; index < matches.length; index++) {
		const element = matches[index];
		updatedInput = updatedInput.replace(element, `"${element}"`);
	}

	return updatedInput;
}

function errorHandling(
	workspaceRoot: string | undefined,
	isQwik: boolean,
	packageManagerUsed: string | undefined,
	filesByPackageManager: { [key: string]: string },
): boolean | undefined {
	if (!workspaceRoot) {
		return false;
	}
	if (!isQwik) {
		return false;
	}
	if (!packageManagerUsed) {
		const packageManagersSearchedFor = `${Object.values(
			filesByPackageManager,
		)}`;
		vscode.window.showErrorMessage(
			`Package manager was not found, ${packageManagersSearchedFor}`,
		);
		return false;
	}
	return;
}

async function addQwikAstroComponent(
	context: vscode.ExtensionContext,
	type: "tsx" | "jsx" = "tsx",
	packageJSonContents?: JSON,
) {
	const input = await vscode.window.showInputBox({
		prompt: "What is the name of the component?",
		placeHolder: "my-component",
		validateInput: (value: string): string | null => {
			if (!value) {
				return "Component name cannot be empty";
			}
			if (value.includes("/")) {
				return "Component name cannot contain '/'";
			}
			// return empty string for valid input
			return "";
		},
	});

	if (input) {
		const name = input.trim();
		const path = vscode.workspace.workspaceFolders
			? vscode.workspace.workspaceFolders[0].uri.fsPath
			: undefined;
		const fileDir = `${path}/src/components/qwik/${name}/${name}.${type}`;
		if (fs.existsSync(fileDir)) {
			vscode.window.showErrorMessage("Component Already Exists");
			return;
		}
		const contents = await getTemplate(
			context,
			type,
			packageJSonContents as JSON,
			name,
		);

		const componentDir = `${path}/src/components/qwik/${name}`;
		fs.mkdirSync(componentDir, { recursive: true });
		fs.writeFileSync(
			`${path}/src/components/qwik/${name}/${name}.${type}`,
			contents,
		);
	} else {
		vscode.window.showErrorMessage("No Component Details Entered.");
	}
}

async function getTemplate(
	context: vscode.ExtensionContext,
	type: "tsx" | "jsx" | "route",
	packageJsonFileContents: JSON,
	componentName?: string,
): Promise<string> {
	const extensionPath = context.extensionPath;
	const templateName = `${type}Component.txt`;
	let templatePath = path.resolve(
		extensionPath,
		`src/templates/${templateName}`,
	);

	if (!fs.existsSync(templatePath)) {
		templatePath = path.resolve(__dirname, `templates/${templateName}`);
		if (!fs.existsSync(templatePath)) {
			let updatedPath = await searchFile(__dirname, templateName);
			if (updatedPath) {
				templatePath = path.resolve(updatedPath);
			} else {
				updatedPath = await searchFile(extensionPath, templateName);
				if (updatedPath) {
					templatePath = path.resolve(updatedPath);
				} else {
					vscode.window.showErrorMessage("Template not found");
					return "";
				}
			}
		}
	}

	let content = await fs.promises.readFile(templatePath, "utf-8");

	const exceptions = ["route"];
	for (let index = 0; index < exceptions.length; index++) {
		const element = exceptions[index];
		if (type === element) {
			return content;
		}
	}

	if (componentName) {
		let formattedComponentName = componentName
			.toLowerCase()
			.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
		formattedComponentName = formattedComponentName.replace(
			/(^\w|-\w)/g,
			(match) => match.replace(/-/, "").toUpperCase(),
		);
		const packageJson = packageJsonFileContents;
		interface PackageJson {
			dependencies?: { [key: string]: string };
		}
		const isV1 = (packageJson as PackageJson)?.dependencies?.[
			"@builder.io/qwik"
		];
		content = content.replaceAll(
			"interface[name]Props",
			"interface [name]Props",
		);
		content = content.replaceAll("[name]", formattedComponentName);

		if (isV1) {
			const updatedImports = content.replace(
				"@qwik.dev/core",
				"@builder.io/qwik",
			);
			content = updatedImports;
		}
	}
	return content;
}

interface FileStats {
	isDirectory(): boolean;
}

interface FileSystem {
	readdirSync(path: string): string[];
	statSync(path: string): FileStats;
}

interface Path {
	join(...paths: string[]): string;
}

function searchFile(dir: string, fileName: string): string | undefined {
	// read the contents of the directory
	const files: string[] = fs.readdirSync(dir);

	// search through the files
	for (const file of files) {
		if (file[0].includes(".") || file[0].includes("_")) {
			continue;
		}

		// build the full path of the file
		const filePath: string = path.join(dir, file);

		// get the file stats
		const fileStat: FileStats = fs.statSync(filePath);

		// if the file is a directory, recursively search the directory
		if (fileStat.isDirectory()) {
			const result: string | undefined = searchFile(filePath, fileName);
			if (result) {
				return result;
			}
		} else if (file.endsWith(fileName)) {
			const generatedPath: string = filePath;
			return `${generatedPath}`;
		}
	}
	return undefined;
}

async function addAstroRoute(
	context: vscode.ExtensionContext,
	type: "route",
	packageJsonFileContents: JSON,
	componentName?: string,
) {
	const input = await vscode.window.showInputBox({
		prompt: "What is the name of the route?",
		placeHolder: "product/[id]",
		validateInput: (value: string): string | null => {
			if (!value) {
				return "Route name cannot be empty";
			}

			// return empty string for valid input
			return "";
		},
	});
	if (input) {
		let transformedInput = transformInput(input);
		if (transformedInput.endsWith("/")) {
			transformedInput = transformedInput.slice(0, -1);
		}

		const template = await getTemplate(
			context,
			"route",
			packageJsonFileContents,
		);
		let contents = template;

		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage("Workspace not found.");
			return;
		}
		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		const inputParts = transformedInput.split("/");
		let routeDir = `${workspaceRoot}/src/pages/`;
		let fileName = transformedInput;

		if (inputParts.length > 1) {
			fileName = inputParts.pop() as string;
			routeDir = `${routeDir}/${inputParts.join("/")}`;

			for (let index = 0; index < inputParts.length; index++) {
				contents = contents.replace("../", "../../");
			}
		}

		if (fs.existsSync(`${routeDir}/${fileName}.astro`)) {
			vscode.window.showErrorMessage("Route Already Exists");
			return;
		}

		fs.mkdirSync(routeDir, { recursive: true });
		const routeFile = `${routeDir}/${fileName}.astro`;
		fs.writeFileSync(routeFile, contents);

		return contents;
	}
}

async function addQwikUIComponent(url: string) {
	const panel = vscode.window.createWebviewPanel(
		"qwikUI", // Identifies the type of the webview.
		"Qwik UI", // Title of the panel displayed to the Dev
		vscode.ViewColumn.Beside,
		{
			enableScripts: true, // Enable JavaScript in the webview
		},
	);
	panel.webview.html = getWebviewContent(url as string);
}

function getWebviewContent(url: string) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Qwik UI</title>
  <style>
    body, html, iframe {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: none;
    }
  </style>
</head>
<body>
  <iframe src="${url}" frameborder="0"></iframe>
</body>
</html>`;
}

const docsObject: { [key: string]: string } = {
	component: "https://qwik.dev/docs/components/overview/#component",
	useSignal: "https://qwik.dev/docs/components/state/#usesignal",
	useStylesScoped: "https://qwik.dev/docs/components/styles/#scoped-css",
};

interface DocsObject {
	[key: string]: string;
}

function getDocsUrl(selectedText: string, docsObject: DocsObject): string {
	if (docsObject[selectedText]) {
		return docsObject[selectedText];
	}
	return "https://qwik.dev/docs/";
}

function openWebPanelDocs(url: string) {
	const panel = vscode.window.createWebviewPanel(
		"qwikDocs", // Identifies the type of the webview.
		"Qwik Docs", // Title of the panel displayed to the Dev
		vscode.ViewColumn.Beside,
		{
			enableScripts: true, // Enable JavaScript in the webview
		},
	);
	panel.webview.html = getWebviewContent(url as string);
}

function transformSelectedText(text: string): string | undefined {
	let transformedText = text.trim();
	const textLength = transformedText.split(" ").length;
	if (textLength > 1) {
		return undefined;
	}
	transformedText = transformedText
		.replace("$", "")
		.replace(/\(.*?\)/g, "")
		.replace(";", "");

	return transformedText;
}

function addQwikIntegration(packageManager: string) {
	// command is a string to not interfere with the command property in the quickPick

	let ogImgCommand = "install og-img";
	let tauriCommand = "install @tauri-apps/cli";
	if (packageManager === "yarn") {
		ogImgCommand = "add og-img";
		tauriCommand = "add @tauri-apps/cli";
	}
	const qwikIntegrations = [
		{ "display-name": "AuthJS", command: "run qwik add auth" },
		{ "display-name": "Bootstrap", command: "run qwik add bootstrap" },
		{ "display-name": "Builder.io", command: "run qwik add builder.io" },
		{ "display-name": "Cypress", command: "run qwik add cypress" },
		{ "display-name": "Drizzle", command: "run qwik add drizzle" },
		{ "display-name": "Localization", command: "run qwik add localize" },
		{ "display-name": "Qwikest Icons", command: "install @qwikest/icons" },
		{ "display-name": "Qwik Image", command: "install qwik-image" },
		{ "display-name": "Leaflet Map", command: "run qwik add leaflet-map" },
		{ "display-name": "Modular Forms", command: "install @modular-forms/qwik" },
		{ "display-name": "OG Image", command: ogImgCommand },
		{ "display-name": "Orama", command: "run qwik add orama" },
		{ "display-name": "Panda CSS", command: "run qwik add pandacss" },
		{ "display-name": "Partytown", command: "run qwik add partytown" },
		{ "display-name": "Playwright", command: "run qwik add playwright" },
		{ "display-name": "PostCSS", command: "run qwik add postcss" },
		{ "display-name": "Prisma", command: "run qwik add prisma" },
		{ "display-name": "React", command: "run qwik add react" },
		{ "display-name": "Storybook", command: "run qwik add storybook" },
		{
			"display-name": "Styled Vanilla Extract",
			command: "run qwik add styled-vanilla-extract",
		},
		{
			"display-name": "Supabase",
			command: "install @supabase/supabase-js supabase-auth-helpers-qwik",
		},
		{ "display-name": "Tailwind", command: "run qwik add tailwind" },
		{ "display-name": "Tauri", command: tauriCommand },
		{ "display-name": "Turso", command: "run qwik add turso" },
		{ "display-name": "Vitest", command: "run qwik add vitest" },
	];
	// const selectedIntegrations: string[] = [];
	const quickPick = vscode.window.createQuickPick();
	// quickPick.canSelectMany = true;
	quickPick.items = qwikIntegrations.map((integration) => ({
		label: integration["display-name"],
		description: integration.command,
	}));
	quickPick.show();

	quickPick.onDidChangeSelection((selection) => {
		if (selection[0].description) {
			const selectedIntegration = selection[0].description;
			const terminal = vscode.window.createTerminal("Qwik Shortcuts");
			// example: pnpm run qwik add auth
			terminal.sendText(`${packageManager} ${selectedIntegration}`);
			terminal.show();
		}
	});

	// todo: think about how to handle multiple selections?
	// ? should we have this option?
	// quickPick.onDidAccept(() => {
	// 	for (let index = 0; index < selectedIntegrations.length; index++) {
	// 		const element = selectedIntegrations[index];
	// 		const terminal = vscode.window.createTerminal("Qwik Shortcuts");
	// 		terminal.sendText(`${packageManager} ${element}`);
	// 		terminal.show();
	// 	}
	// });
}

function setCustomContext(isQwik: boolean | null, isQwikAstro: boolean | null) {
	vscode.commands.executeCommand("setContext", "isQwik", isQwik);
	vscode.commands.executeCommand("setContext", "isQwikAstro", isQwikAstro);
}

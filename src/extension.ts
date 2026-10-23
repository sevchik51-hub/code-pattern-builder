import * as vscode from 'vscode';

// Типы коротких команд, которые понимает расширение.
type PatternType = 'for' | 'array' | 'main' | 'cout';

// Результат разбора команды: ее тип и параметры.
interface PatternRequest {
	type: PatternType;
	parameters: string[];
}

/*
Преобразует текст текущей строки в понятную программе структуру.
Примеры:
@m          -> главная функция main
@a numbers  -> цикл по элементам numbers
@f 0 10 +   -> цикл от 0 до 10 с увеличением
@c          -> вывод через std::cout
Если команда написана неправильно, функция возвращает undefined.
*/
export function parsePattern(line: string): PatternRequest | undefined {
	const parts = line.trim().split(/\s+/);
	const command = parts[0];

	if (command === '@m' && parts.length === 1) {
		return { type: 'main', parameters: [] };
	}

	if (command === '@a' && parts.length === 2) {
		return { type: 'array', parameters: [parts[1]] };
	}

	if (command === '@f' && parts.length === 4 && (parts[3] === '+' || parts[3] === '-')) {
		return { type: 'for', parameters: [parts[1], parts[2], parts[3]] };
	}

	if (command === '@c' && parts.length === 1) {
		return { type: 'cout', parameters: [] };
	}

	return undefined;
}

/*
Создает готовый фрагмент C++ по результату parsePattern().
Функция только выбирает шаблон
и подставляет в него параметры команды.
*/
export function buildPattern(request: PatternRequest): string {
	if (request.type === 'main') {
		return 'int main(int argc, char** argv) {\n\t\n\treturn 0;\n}';
	}

	if (request.type === 'array') {
		const [arrayName] = request.parameters;
		return `for (auto i : ${arrayName}) {\n\t\n}`;
	}

	if (request.type === 'cout') {
		return 'std::cout <<  << std::endl;';
	}

	const [start, limit, direction] = request.parameters;
	const comparison = direction === '+' ? '<' : '>';
	const step = direction === '+' ? '++i' : '--i';
	return `for (int i = ${start}; i ${comparison} ${limit}; ${step}) {\n\t\n}`;
}

/*
Раскрывает команду или передает нажатие клавиши обратно VS Code.

Если текущая строка содержит известный паттерн, он заменяется
сгенерированным кодом. Если паттерна нет, Enter или Tab работают как обычно.
 */
async function expandPatternOrType(text: string): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	const line = editor.document.lineAt(editor.selection.active.line);
	const request = parsePattern(line.text);
	if (!request) {
		await vscode.commands.executeCommand('type', { text });
		return;
	}

	const generatedCode = buildPattern(request);
	const indentation = line.text.match(/^\s*/)?.[0] ?? '';
	const indentedCode = generatedCode
		.split('\n')
		.map((codeLine) => indentation + codeLine)
		.join('\n');

	await editor.edit((editBuilder) => {
		editBuilder.replace(line.range, indentedCode);
	});
}

/*
Регистрирует команды расширения при его запуске.

Команды объявлены в package.json, а здесь каждой команде назначается действие.
Зарегистрированные команды добавляютсяьв context.subscriptions,
чтобы VS Code корректно освободил их.
 */
export function activate(context: vscode.ExtensionContext) {
	const createPattern = vscode.commands.registerCommand(
		'code-pattern-builder.createPattern',
		() => expandPatternOrType(''),
	);
	const expandOnEnter = vscode.commands.registerCommand(
		'code-pattern-builder.expandOnEnter',
		() => expandPatternOrType('\n'),
	);
	const expandOnTab = vscode.commands.registerCommand(
		'code-pattern-builder.expandOnTab',
		() => expandPatternOrType('\t'),
	);

	context.subscriptions.push(createPattern, expandOnEnter, expandOnTab);
}

// Текущему расширению не требуется специальное действие при выключении.
export function deactivate() {}
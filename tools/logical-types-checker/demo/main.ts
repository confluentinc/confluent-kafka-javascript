import { checkSyntax } from "../src/index.js";

const input = document.getElementById("input") as HTMLTextAreaElement;
const checkButton = document.getElementById("check") as HTMLButtonElement;
const output = document.getElementById("output") as HTMLElement;

function render(): void {
    const result = checkSyntax(input.value);

    if (result.valid) {
        output.textContent = "Valid.";
        output.className = "valid";
        return;
    }

    output.className = "invalid";
    output.textContent = result.errors
        .map((e) => `line ${e.line}:${e.column} — ${e.message}`)
        .join("\n");
}

checkButton.addEventListener("click", render);

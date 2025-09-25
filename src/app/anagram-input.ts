import type { AnagramElements } from "../shared/anagram-list-messages";

function getAnagramElementsFromString(input: string): AnagramElements {
    let match;
    const result: AnagramElements = [];
    const regex = /\w/g;
    while((match = regex.exec(input)) != null){
        result.push(match[0]);
    }
    return result;
}
export class AnagramInput extends HTMLElement {
    private _value: AnagramElements = []
    public get value(): AnagramElements {
        return this._value;
    }
    protected connectedCallback(){
        const templateEl = document.getElementById('anagram-input-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);
        const input = shadow.querySelector('input')!;
        input.addEventListener('input', (e) => {
            e.stopPropagation();
            const inputValue = input.value;
            this._value = getAnagramElementsFromString(inputValue);
            const customEvent = new CustomEvent('input');
            this.dispatchEvent(customEvent);
        })
    }
}

customElements.define('anagram-input', AnagramInput);

declare global {
    interface HTMLElementTagNameMap {
        'anagram-input': AnagramInput
    }
}
import type { AnagramElements } from "../shared/anagram-list-messages";
import { RegisteredListeners, type EventTargetWithMap } from "./utils";
import './anagram-input-element'
import './anagram-input-drop-location';
import { AnagramInputElement, type AnagramInputElementEventMap } from "./anagram-input-element";
import { AnagramInputDropLocation } from "./anagram-input-drop-location";

function getAnagramElementsFromString(input: string): AnagramElements {
    let match;
    const result: AnagramElements = [];
    const regex = /\w/g;
    while((match = regex.exec(input)) != null){
        result.push(match[0]);
    }
    return result;
}

function createDropLocation(draggedElement: AnagramInputElement): AnagramInputDropLocation {
    const element = document.createElement('anagram-input-drop-location');
    element.draggedValue = draggedElement.value;
    return element;
}

class ConnectedAnagramInput {
    private listeners: RegisteredListeners = new RegisteredListeners();
    private elements: AnagramInputElement[] = []
    private draggedElement: AnagramInputElement | undefined
    private dropLocation1: AnagramInputDropLocation | undefined
    private dropLocation2: AnagramInputDropLocation | undefined
    public get value(): AnagramElements {
        return this.elements.map(e => e.value)
    }
    constructor(
        private readonly container: HTMLElement,
        private readonly input: HTMLInputElement,
        private readonly elementsContainer: HTMLElement,
        private readonly dispatchEvent: (ev: Event) => void
    ){
        const elementsContainerEventTarget = elementsContainer as EventTargetWithMap<HTMLElement, AnagramInputElementEventMap>
        this.listeners.target(input).addEventListener('input', (e) => this.handleInput(e))
        this.listeners.target(input).addEventListener('focus', () => this.handleInputFocus());
        this.listeners.target(input).addEventListener('blur', () => this.handleInputBlur())
        this.listeners.target(input).addEventListener('keydown', (e) => this.handleInputKeydown(e))
        this.listeners.target(elementsContainerEventTarget).addEventListener('elementremoved', (e) => this.handleElementRemoved(e))
        this.listeners.target(elementsContainerEventTarget).addEventListener('elementdragstart', (e) => this.handleElementDragStart(e))
        this.listeners.target(elementsContainerEventTarget).addEventListener('elementdragend', (e) => this.handleElementDragEnd(e))
        this.listeners.target(elementsContainerEventTarget).addEventListener('elementdragenter', (e) => this.handleElementDragEnter(e))
        this.listeners.target(container).addEventListener('click', () => this.handleContainerClick())
        this.listeners.target(container).addEventListener('dragleave', (e) => this.handleContainerDragLeave(e))
        this.listeners.target(container).addEventListener('dragenter', (e) => this.handleContainerDragEnter(e))
    }

    private handleContainerClick(): void {
        this.input.focus();
    }

    private handleInputKeydown(e: KeyboardEvent): void {
        if(e.key !== 'Backspace'){
            return;
        }
        if(this.elements.length === 0) {
            return;
        }
        const lastElement = this.elements[this.elements.length - 1];
        lastElement.removeCharacter();
    }
    private handleContainerDragEnter(e: DragEvent): void {

    }
    private handleContainerDragLeave(e: DragEvent): void {
        
        if(e.target !== this.container) {
            return;
        }
        const { x, y, width, height} = this.container.getBoundingClientRect();
        if(e.clientX >= x && e.clientX <= x + width && e.clientY >= y && e.clientY <= y + height) {
            return;
        }
        this.removeDropLocation1();
        this.removeDropLocation2();
    }

    private handleInputFocus(): void {
        this.container.classList.add('focused')
    }

    private handleInputBlur(): void {
        this.container.classList.remove('focused')
    }

    private handleInput(e: Event) {
        e.stopPropagation();
        const inputValue = this.input.value;
        const elements = getAnagramElementsFromString(inputValue);
        let elementAdded = false;
        for(const element of elements) {
            const partElement = document.createElement('anagram-input-element');
            partElement.value = element;
            this.elementsContainer.appendChild(partElement);
            this.elements.push(partElement);
            elementAdded = true;
        }
        this.input.value = '';
        if(!elementAdded){
            return;
        }
        this.checkEmpty();
        this.dispatchEvent(new CustomEvent('input'));
    }

    private handleElementRemoved(e: Event): void {
        this.removeElement(e.target);
    }

    private handleElementDragStart(e: Event): void {
        const target = e.target;
        if(!(target instanceof AnagramInputElement)) {
            return;
        }
        this.draggedElement = target;
        this.container.classList.add('dragging');
    }

    private handleElementDragEnd(e: Event): void {
        const target = e.target;
        if(!(target instanceof AnagramInputElement) || target !== this.draggedElement) {
            return;
        }
        this.draggedElement = undefined;
        this.removeDropLocation1();
        this.removeDropLocation2();
        this.container.classList.remove('dragging')
    }

    private handleElementDragEnter(e: Event): void {
        if(!this.draggedElement) {
            return;
        }
        const target = e.target;
        if(target instanceof AnagramInputElement) {
            this.handleElementDragEnterElement(target);
            return;
        }
        if(target instanceof AnagramInputDropLocation) {
            this.handleElementDragEnterDropLocation(target);
            return;
        }
        
    }

    private handleElementDragEnterDropLocation(location: AnagramInputDropLocation): void {
        if(location === this.dropLocation1) {
            this.removeDropLocation2();
            return;
        }
        if(location === this.dropLocation2) {
            this.removeDropLocation1();
            return;
        }
    }

    private handleElementDragEnterElement(element: AnagramInputElement): void {
        if(!this.draggedElement){
            return;
        }
        if(this.draggedElement === element) {
            this.removeDropLocation1();
            this.removeDropLocation2();
            return;
        }
        const elementIndex = this.elements.indexOf(element);
        const leftOfElement = elementIndex > 0 ? this.elements[elementIndex - 1] : undefined;
        const rightOfElement = elementIndex > -1 && elementIndex < this.elements.length - 1 ? this.elements[elementIndex + 1] : undefined;
        if(leftOfElement !== this.draggedElement) {
            if(!this.dropLocation1) {
                this.dropLocation1 = createDropLocation(this.draggedElement);
            }
            if(this.dropLocation1.nextElementSibling !== element) {
                this.elementsContainer.insertBefore(this.dropLocation1, element);
            }
        }else{
            this.removeDropLocation1();
        }
        if(rightOfElement !== this.draggedElement) {
            if(!this.dropLocation2){
                this.dropLocation2 = createDropLocation(this.draggedElement);
                if(rightOfElement === undefined){
                    this.elementsContainer.appendChild(this.dropLocation2)
                }
            }
            if(rightOfElement === undefined){
                if(this.dropLocation2.nextElementSibling !== null) {
                    this.elementsContainer.appendChild(this.dropLocation2)
                }   
            }else{
                if(this.dropLocation2.nextElementSibling !== rightOfElement){
                    this.elementsContainer.insertBefore(this.dropLocation2, rightOfElement)
                }
                
            }
        }else{
            this.removeDropLocation2();
        }
    }
    
    private removeDropLocation1(): void {
        if(this.dropLocation1){
            this.dropLocation1.remove();
            this.dropLocation1 = undefined;
        }
    }
    private removeDropLocation2(): void {
        if(this.dropLocation2){
            this.dropLocation2.remove();
            this.dropLocation2 = undefined;
        }
    }
    private removeElement(element: unknown): void {
        if(!(element instanceof AnagramInputElement)) {
            return;
        }
        const index = this.elements.indexOf(element);
        if(index === -1){
            return;
        }
        this.elements.splice(index, 1);
        element.remove();
        this.checkEmpty();
        this.dispatchEvent(new CustomEvent('input'));
    }

    private checkEmpty(): void {
        if(this.elements.length > 0) {
            this.container.classList.remove('empty')
        } else {
            this.container.classList.add('empty')
        }
    }

    destroy(): void {
        this.listeners.destroy();
    }

    static create(
        shadow: ShadowRoot,
        dispatchEvent: (ev: Event) => void
    ): ConnectedAnagramInput {
        const container = shadow.getElementById('container') as HTMLElement;
        const input = shadow.getElementById('input') as HTMLInputElement;
        const elements = shadow.getElementById('elements') as HTMLElement;
        return new ConnectedAnagramInput(
            container,
            input,
            elements,
            dispatchEvent
        );
    }
}
export class AnagramInput extends HTMLElement {
    private connected: ConnectedAnagramInput | undefined
    public get value(): AnagramElements {
        if(!this.connected) {
            return []
        }
        return this.connected.value;
    }
    protected connectedCallback(){
        const templateEl = document.getElementById('anagram-input-template') as HTMLTemplateElement;
        const content = templateEl.content.cloneNode(true);
        const shadow = this.attachShadow({mode: 'open'});
        shadow.appendChild(content);

        const connected = ConnectedAnagramInput.create(shadow, (e) => this.dispatchEvent(e))
        this.connected = connected;
    }

    protected disconnectedCallback() {
        if(this.connected){
            this.connected.destroy();
            this.connected = undefined;
        }
    }
}

customElements.define('anagram-input', AnagramInput);

declare global {
    interface HTMLElementTagNameMap {
        'anagram-input': AnagramInput
    }
}
import type { AnagramElements } from "../shared/anagram-list-messages";
import { RegisteredListeners, type EventTargetWithMap } from "./utils";
import './anagram-input-element'
import './anagram-input-overlay-element'
import { AnagramInputElement, type AnagramInputElementEventMap } from "./anagram-input-element";
import { AnagramInputOverlayElement, type AnagramInputOverlayEventMap } from "./anagram-input-overlay-element";

function getAnagramElementsFromString(input: string): AnagramElements {
    let match;
    const result: AnagramElements = [];
    const regex = /\w/g;
    while((match = regex.exec(input)) != null){
        result.push(match[0]);
    }
    return result;
}


class ConnectedAnagramInput {
    private listeners: RegisteredListeners = new RegisteredListeners();
    private elements: AnagramInputElement[] = []
    private draggedElement: AnagramInputElement | undefined
    private overlayElements: AnagramInputOverlayElement[] = []
    private draggedElementPreview: AnagramInputElement | undefined
    public get value(): AnagramElements {
        return this.elements.map(e => e.value)
    }
    constructor(
        private readonly container: HTMLElement,
        private readonly input: HTMLInputElement,
        private readonly elementsContainer: HTMLElement,
        private readonly overlayElementsContainer: HTMLElement,
        private readonly dispatchEvent: (ev: Event) => void
    ){
        const elementsContainerEventTarget = elementsContainer as EventTargetWithMap<HTMLElement, AnagramInputElementEventMap>
        const overlayElementsContainerTarget = this.listeners.target<EventTargetWithMap<HTMLElement, AnagramInputOverlayEventMap>>(overlayElementsContainer);
        this.listeners.target(input).addEventListener('input', (e) => this.handleInput(e))
        this.listeners.target(input).addEventListener('focus', () => this.handleInputFocus());
        this.listeners.target(input).addEventListener('blur', () => this.handleInputBlur())
        this.listeners.target(input).addEventListener('keydown', (e) => this.handleInputKeydown(e))
        this.listeners.target(elementsContainerEventTarget).addEventListener('elementremoved', (e) => this.handleElementRemoved(e))
        this.listeners.target(elementsContainerEventTarget).addEventListener('elementdragstart', (e) => this.handleElementDragStart(e))
        this.listeners.target(elementsContainerEventTarget).addEventListener('elementdragend', () => this.handleElementDragEnd())
        overlayElementsContainerTarget.addEventListener('elementdragenter', (e) => this.handleElementDragEnterOverlayElement(e))
        overlayElementsContainerTarget.addEventListener('elementdragenterinterstice', (e) => this.handleElementDragEnterOverlayInsterstice(e))
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
        this.setupOverlay(target);
        this.container.classList.add('drag-active');
    }

    private findCorrespondingElement(overlayElement: AnagramInputOverlayElement): AnagramInputElement | undefined {
        const draggedElement = this.draggedElement;
        if(!draggedElement){
            return;
        }
        const draggedElementIndex = this.elements.indexOf(draggedElement);
        if(draggedElementIndex === -1){
            return;
        }
        let index = this.overlayElements.indexOf(overlayElement);
        if(index === -1){
            return;
        }
        if(index >= draggedElementIndex){
            index++;
        }
        return this.elements[index];
    }

    private handleElementDragEnterOverlayElement(e: Event): void {
        const target = e.target;
        if(!(target instanceof AnagramInputOverlayElement)){
            return;
        }
        const element = this.findCorrespondingElement(target);
        if(!element){
            return;
        }
        console.log(`drag entered overlay element for element '${element.value}'`)
        this.removeDraggedElementPreview();
    }

    private handleElementDragEnterOverlayInsterstice(e: Event): void {
        const target = e.target;
        if(!(target instanceof AnagramInputOverlayElement)){
            return;
        }
        const element = this.findCorrespondingElement(target);
        if(!element){
            return;
        }
        console.log(`drag entered interstice after element '${element.value}'`)
        this.displayDraggedElementPreview(element);
    }

    private setupOverlay(draggedElement: AnagramInputElement): void {
        for(let i = 0; i < this.elements.length; i++){
            const element = this.elements[i];
            if(element === draggedElement) {
                continue;
            }
            const overlayElement = document.createElement('anagram-input-overlay-element');
            overlayElement.value = element.value;
            this.overlayElementsContainer.appendChild(overlayElement);
            this.overlayElements.push(overlayElement)
        }
    }

    private displayDraggedElementPreview(afterElement: AnagramInputElement): void {
        const draggedElement = this.draggedElement;
        if(!draggedElement){
            return;
        }
        const elementIndex = this.elements.indexOf(afterElement);
        if(elementIndex === -1){
            return;
        }
        const nextElement = elementIndex < this.elements.length - 1 ? this.elements[elementIndex + 1] : undefined;
        const draggedElementPreview = document.createElement('anagram-input-element');
        draggedElementPreview.value = draggedElement.value;
        if(nextElement){
            this.elementsContainer.insertBefore(draggedElementPreview, nextElement);
        }else{
            this.elementsContainer.appendChild(draggedElementPreview)
        }
        this.draggedElementPreview = draggedElementPreview;
    }

    private removeDraggedElementPreview(): void {
        if(this.draggedElementPreview){
            this.draggedElementPreview.remove();
            this.draggedElementPreview = undefined;
        }
    }

    private clearOverlay(): void {
        for(const overlayElement of this.overlayElements) {
            overlayElement.remove();
        }
        this.overlayElements.splice(0, this.overlayElements.length);
    }

    private handleElementDragEnd(): void {
        this.clearOverlay();
        this.removeDraggedElementPreview();
        this.container.classList.remove('drag-active');
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
        const overlayElementsContainer = shadow.getElementById('overlay-elements') as HTMLElement;
        return new ConnectedAnagramInput(
            container,
            input,
            elements,
            overlayElementsContainer,
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
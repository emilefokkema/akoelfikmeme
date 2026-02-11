import type { AnagramElements } from "../shared/anagram-list-messages";
import { RegisteredListeners, type EventTargetWithMap } from "./utils";
import './anagram-input-element'
import './anagram-input-overlay-element'
import { AnagramInputElement, type AnagramInputElementEventMap } from "./anagram-input-element";
import { AnagramInputOverlayElement, type AnagramInputOverlayEventMap, type ElementDragEnterEvent, type ElementDropEvent } from "./anagram-input-overlay-element";

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
    private elementWithDraggedElementPreview: AnagramInputElement | undefined
    public get value(): AnagramElements {
        return this.elements.map(e => e.value)
    }
    constructor(
        private readonly container: HTMLElement,
        private readonly input: HTMLInputElement,
        private readonly elementsContainer: HTMLElement,
        private readonly overlayElementsContainer: HTMLElement,
        private readonly firstInterstice: HTMLElement,
        private readonly dispatchEvent: (ev: Event) => void
    ){
        const elementsContainerEventTarget = this.listeners.target<EventTargetWithMap<HTMLElement, AnagramInputElementEventMap>>(elementsContainer)
        const overlayElementsContainerTarget = this.listeners.target<EventTargetWithMap<HTMLElement, AnagramInputOverlayEventMap>>(overlayElementsContainer);
        const firstIntersticeTarget = this.listeners.target(firstInterstice);
        const inputTarget = this.listeners.target(input)
        const containerTarget = this.listeners.target(container);
        inputTarget.addEventListener('input', (e) => this.handleInput(e))
        inputTarget.addEventListener('focus', () => this.handleInputFocus());
        inputTarget.addEventListener('blur', () => this.handleInputBlur())
        inputTarget.addEventListener('keydown', (e) => this.handleInputKeydown(e))
        elementsContainerEventTarget.addEventListener('elementdragstart', (e) => this.handleElementDragStart(e))
        elementsContainerEventTarget.addEventListener('elementdragend', () => this.handleElementDragEnd())
        overlayElementsContainerTarget.addEventListener('elementdrop', (e) => this.handleElementDrop(e))
        overlayElementsContainerTarget.addEventListener('elementdragenter', (e) => this.handleElementDragEnter(e))
        firstIntersticeTarget.addEventListener('dragenter', (e) => this.handleDragEnterFirstInterstice(e))
        firstIntersticeTarget.addEventListener('dragover', (e) => this.handleDragOverFirstInterstice(e))
        firstIntersticeTarget.addEventListener('drop', (e) => this.handleDropInFirstInterstice(e))
        containerTarget.addEventListener('click', () => this.handleContainerClick())
        containerTarget.addEventListener('dragenter', (e) => this.handleContainerDragEnter(e))
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
        const someAreLonger = this.elements.some(e => e.value.length > 1);
        if(someAreLonger){
            this.splitLongerElements();
        }else{
            this.removeLastElement();
        }
        this.dispatchEvent(new CustomEvent('input'));
    }

    private splitLongerElements(): void {
        const allCharacters = this.elements.reduce((all, el) => `${all}${el.value}`, '');
        const newElementValues = getAnagramElementsFromString(allCharacters);
        const oldElements = this.elements.splice(0, this.elements.length);
        for(const oldElement of oldElements){
            oldElement.remove();
        }
        for(const value of newElementValues){
            const newElement = document.createElement('anagram-input-element');
            newElement.value = value;
            this.elementsContainer.appendChild(newElement);
            this.elements.push(newElement);
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

    private handleElementDragEnter(e: ElementDragEnterEvent): void {
        const draggedElement = this.draggedElement;
        if(!draggedElement){
            return;
        }
        const target = e.target;
        if(!(target instanceof AnagramInputOverlayElement)){
            return;
        }
        const element = this.findCorrespondingElement(target);
        if(!element){
            return;
        }
        if(e.detail.location === 'inside'){
            this.handleElementDragEnterElement(element);
            return;
        }
        this.handleElementDragEnterAfterElement(element);
    }

    private handleElementDragEnterElement(element: AnagramInputElement): void {
        const draggedElement = this.draggedElement;
        if(!draggedElement){
            return;
        }
        this.removeDraggedElementPreview();
        this.removeDraggedElementPreviewFromElement();
        element.displayAddedValuePreview(draggedElement.value);
        this.elementWithDraggedElementPreview = element;
    }

    private removeDraggedElementPreviewFromElement(): void {
        const elementWithDraggedElementPreview = this.elementWithDraggedElementPreview;
        if(!elementWithDraggedElementPreview){
            return;
        }
        elementWithDraggedElementPreview.hideAddedValuePreview();
        this.elementWithDraggedElementPreview = undefined;
    }

    private handleElementDragEnterAfterElement(element: AnagramInputElement): void {
        this.removeDraggedElementPreviewFromElement();
        this.displayDraggedElementPreview(element);
    }

    private handleDragEnterFirstInterstice(e: DragEvent): void {
        if(!e.dataTransfer?.types.includes('anagram/element')){
            return;
        }
        e.stopPropagation();
        this.removeDraggedElementPreviewFromElement();
        this.displayDraggedElementPreview(undefined);
    }

    private handleDragOverFirstInterstice(e: DragEvent): void {
        if(!e.dataTransfer?.types.includes('anagram/element')){
            return;
        }

        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move'
    }

    private handleElementDrop(e: ElementDropEvent): void {
        const target = e.target;
        if(!(target instanceof AnagramInputOverlayElement)){
            return;
        }
        const element = this.findCorrespondingElement(target);
        if(!element){
            return;
        }
        if(e.detail.location === 'after'){
            this.moveDraggedElementAfterElement(element);
            return;
        }
        this.moveDraggedElementIntoElement(element);
    }

    private moveDraggedElementAfterElement(element: AnagramInputElement): void {
        const draggedElement = this.draggedElement;
        if(!draggedElement){
            return;
        }
        const successor = this.findSuccessor(element);
        const index = this.elements.indexOf(draggedElement);
        this.elements.splice(index, 1);
        if(successor){
            const successorIndex = this.elements.indexOf(successor);
            this.elements.splice(successorIndex, 0, draggedElement)
            this.elementsContainer.insertBefore(draggedElement, successor);
        }else{
            this.elements.push(draggedElement);
            this.elementsContainer.appendChild(draggedElement)
        }
        this.dispatchEvent(new CustomEvent('input'));
    }

    private moveDraggedElementIntoElement(element: AnagramInputElement): void {
        const draggedElement = this.draggedElement;
        if(!draggedElement){
            return;
        }
        const index = this.elements.indexOf(draggedElement);
        this.elements.splice(index, 1);
        element.value = `${element.value}${draggedElement.value}`;
        draggedElement.remove();
        this.handleElementDragEnd();
        this.dispatchEvent(new CustomEvent('input'));
    }

    private handleDropInFirstInterstice(e: DragEvent): void {
        if(!e.dataTransfer?.types.includes('anagram/element')){
            return;
        }
        const draggedElement = this.draggedElement;
        if(!draggedElement){
            return;
        }
        const index = this.elements.indexOf(draggedElement);
        const firstElement = this.elements[0];
        this.elements.splice(index, 1);
        this.elements.splice(0, 0, draggedElement);
        this.elementsContainer.insertBefore(draggedElement, firstElement);
        this.dispatchEvent(new CustomEvent('input'));
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

    private handleContainerDragEnter(e: DragEvent): void {
        const path = e.composedPath();
        if(path.some(t => t === this.overlayElementsContainer)){
            return;
        }
        this.removeDraggedElementPreview();
    }

    private findSuccessor(element: AnagramInputElement | undefined): AnagramInputElement | undefined {
        if(!element) {
            return this.elements[0];
        }
        const elementIndex = this.elements.indexOf(element);
        if(elementIndex === -1){
            return undefined;
        }
        return elementIndex < this.elements.length - 1 ? this.elements[elementIndex + 1] : undefined;
    }

    private displayDraggedElementPreview(afterElement: AnagramInputElement | undefined): void {
        const draggedElement = this.draggedElement;
        if(!draggedElement){
            return;
        }
        const nextElement = this.findSuccessor(afterElement);
        let draggedElementPreview = this.draggedElementPreview;
        if(!draggedElementPreview) {
            draggedElementPreview = document.createElement('anagram-input-element');
            draggedElementPreview.value = draggedElement.value;
            this.draggedElementPreview = draggedElementPreview;
        }
        if(nextElement){
            this.elementsContainer.insertBefore(draggedElementPreview, nextElement);
        }else{
            this.elementsContainer.appendChild(draggedElementPreview)
        }
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
        this.removeDraggedElementPreviewFromElement();
        this.container.classList.remove('drag-active');
        this.draggedElement = undefined;
    }

    private removeLastElement(): void {
        const lastElementIndex = this.elements.length - 1;
        const [lastElement] = this.elements.splice(lastElementIndex, 1);
        lastElement.remove();
        this.checkEmpty();
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
        const firstInterstice = shadow.getElementById('first-interstice') as HTMLElement;
        return new ConnectedAnagramInput(
            container,
            input,
            elements,
            overlayElementsContainer,
            firstInterstice,
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
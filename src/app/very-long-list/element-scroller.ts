import { waitMs } from "../utils";

export class ElementScroller {
    private readonly scrollListener: () => void
    private onDidScroll: (() => void) | undefined;
    constructor(private readonly element: Element){
        this.scrollListener = () => this.handleScroll();
        element.addEventListener('scroll', this.scrollListener);
    }
    destroy(): void {
        this.element.removeEventListener('scroll', this.scrollListener);
    }
    async scrollTo(scrollTop: number): Promise<void> {
        let nrOfAttempts = 0;
        while(nrOfAttempts < 5){
            const actual = this.element.scrollTop;
            if(Math.abs(actual - scrollTop) < 3){
                return;
            }
            const scrollPromise = this.whenScrolled();
            this.element.scrollTop = scrollTop;
            await Promise.race([
                scrollPromise,
                waitMs(10)
            ])
            nrOfAttempts++;
        }
        throw new Error('Could not scroll the element')
    }
    private whenScrolled(): Promise<void> {
        return new Promise((res) => {
            this.onDidScroll = res;
        })
    }
    private handleScroll(): void {
        if(this.onDidScroll){
            this.onDidScroll();
            this.onDidScroll = undefined;
        }
    }
}
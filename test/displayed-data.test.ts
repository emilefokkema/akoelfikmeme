import { describe, it, expect, vi, type Mock } from "vitest";
import { DisplayedData, type DisplayHeightRatioChangedEvent, type ScrolledRatioChangedEvent } from "../src/app/very-long-list/displayed-data";
import type { ContentDisplay, DisplayedItem } from "../src/app/very-long-list/content-display";
import type { VeryLongListData, VeryLongListItems } from "../src/app/very-long-list/very-long-list-data";
import { asyncFn, type AsyncFn } from "./async-fn";

vi.useFakeTimers();

describe('displayed data', () => {

    it('should', async () => {
        const itemHeight = 10;
        const displayHeight = 85;
        const numberOfItems = 10 ** 4;
        const initialNumberOfItems = 2;
        const { 
            getRelativePositionOfItemMock,
            getRelativePositionOfItem,
            getItemsAfterItemMock,
            getItemsAfterItem,
            getItemsBeforeItemMock,
            getItemsBeforeItem,
            data
        } = createNumbersForVeryLongList({ numberOfItems, initialNumberOfItems });
        const { 
            contentDisplay,
            displayedItems,
            prependItemsMock,
            getDisplayedHeightMock,
        } = createNumberDisplay()
        getRelativePositionOfItemMock.resolveAllCalls((item: number) => getRelativePositionOfItem(item))

        let latestScrolledRatio: ScrolledRatioChangedEvent['detail'] | undefined
        let latestDisplayHeightRatio: DisplayHeightRatioChangedEvent['detail'] | undefined

        const abortController = new AbortController();
        const displayedData = DisplayedData.create(
            data,
            contentDisplay,
            displayHeight,
            abortController.signal
        )
        displayedData.addEventListener('displayheightratiochanged', ({ detail }) => latestDisplayHeightRatio = detail);
        displayedData.addEventListener('scrolledratiochanged', ({ detail }) => latestScrolledRatio = detail)

        let expectedFirstDisplayedItem = 0;
        let expectedLastDisplayedItem = 0;
        let expectedScrolledRatio = 0;
        let scrollTop = 0;
        const scrollRatio = 1 / ( numberOfItems * itemHeight );

        // first item should always be displayed
        await assertDisplayedItems();

        // answer height of item
        await getDisplayedHeightMock.resolveCall((displayedItem) => displayedItem === 0, itemHeight);

        expectedLastDisplayedItem = initialNumberOfItems - 1;

        // all initial items should be displayed
        await assertDisplayedItems();

        await verifyItemsAddedToBottom(24);

        // scrolled ratio should have been emitted
        await assertScrolledRatio();

        // display height ratio should have been emitted
        await expect.poll(() => latestDisplayHeightRatio).toEqual({ displayHeightRatio: expect.closeTo(displayHeight / (itemHeight * numberOfItems), 5)})
        
        await verifyScrolledDown({ scrollTopChange: 50 })

        await verifyScrolledDown({
            scrollTopChange: 100,
            numberOfItemsAddedToBottom: 9
        })

        await verifyScrolledDown({
            scrollTopChange: 50,
            numberOfItemsRemovedFromTop: 11,
            numberOfItemsAddedToBottom: 9
        })

        await verifyScrolledDown({
            scrollTopChange: 135,
            numberOfItemsAddedToBottom: 9,
            numberOfItemsRemovedFromTop: 14
        })

        await verifyScrolledUp({
            scrollTopChange: -75,
            numberOfItemsRemovedFromBottom: 10,
            numberOfItemsAddedToTop: 8
        })

        await verifyScrolledUp({
            scrollTopChange: -70,
            numberOfItemsAddedToTop: 8
        })

        await verifyScrolledUp({
            scrollTopChange: -85,
            numberOfItemsRemovedFromBottom: 16,
            numberOfItemsAddedToTop: 8
        })

        async function assertScrolledRatio() {
            await expect.poll(() => latestScrolledRatio).toEqual({ scrolledRatio: expect.closeTo(expectedScrolledRatio, 5) })
        }

        async function assertDisplayedItems() {
            await expect.poll(() => displayedItems).toEqual(numberSequence(expectedFirstDisplayedItem, expectedLastDisplayedItem));
        }

        async function verifyScrolledDown({
            scrollTopChange,
            numberOfItemsRemovedFromTop,
            numberOfItemsAddedToBottom
        }: ScrolledDownVerification){
            // after 200ms, scroll
            vi.advanceTimersByTime(200);
            changeScrollTop(scrollTopChange);
            displayedData.setScrollTop(scrollTop);

            // scrolled ratio should have been emitted again
            await assertScrolledRatio();

            if(numberOfItemsRemovedFromTop !== undefined) {
                expectedFirstDisplayedItem += numberOfItemsRemovedFromTop;
                // fewer items should be displayed now
                await assertDisplayedItems();
            }

            if(numberOfItemsAddedToBottom !== undefined) {
                await verifyItemsAddedToBottom(numberOfItemsAddedToBottom);
            }

            if(numberOfItemsRemovedFromTop !== undefined) {
                expectedScrolledRatio += numberOfItemsRemovedFromTop * itemHeight * scrollRatio;
                // a 'wrong' scrolled ratio should have been emitted
                await assertScrolledRatio();

                // because the items have been removed from the top,
                // a new scroll top is set
                vi.advanceTimersByTime(200);
                changeScrollTop(-numberOfItemsRemovedFromTop * itemHeight)
                displayedData.setScrollTop(scrollTop);

                // the 'right' scrolled ratio should have been emitted
                await assertScrolledRatio();
            }
        }

        async function verifyItemsAddedToBottom(numberOfItemsAdded: number) {
            // answer more items
            await getItemsAfterItemMock.resolveCall(
                (item, numberOfItems) => item === expectedLastDisplayedItem && numberOfItems === numberOfItemsAdded,
                getItemsAfterItem(expectedLastDisplayedItem, numberOfItemsAdded)
            )

            expectedLastDisplayedItem += numberOfItemsAdded;
            // more items should be displayed
            await assertDisplayedItems();
        }

        async function verifyScrolledUp({ 
            scrollTopChange,
            numberOfItemsRemovedFromBottom,
            numberOfItemsAddedToTop
        }: ScrolledUpVerification) {
            // after 200ms, scroll more
            vi.advanceTimersByTime(200);
            changeScrollTop(scrollTopChange);
            displayedData.setScrollTop(scrollTop);

            // scrolled ratio should have been emitted again
            await assertScrolledRatio();

            if(numberOfItemsRemovedFromBottom !== undefined) {
                expectedLastDisplayedItem -= numberOfItemsRemovedFromBottom;

                // fewer items should be displayed now
                await assertDisplayedItems();
            }

            if(numberOfItemsAddedToTop !== undefined) {
                // answer more items
                await getItemsBeforeItemMock.resolveCall(
                    (item, numberOfItems) => item === expectedFirstDisplayedItem && numberOfItems === numberOfItemsAddedToTop,
                    getItemsBeforeItem(expectedFirstDisplayedItem, numberOfItemsAddedToTop)
                );

                let previousExpectedFirstDisplayedItem = expectedFirstDisplayedItem;
                expectedFirstDisplayedItem -= numberOfItemsAddedToTop
                // more items should be displayed now
                await assertDisplayedItems();

                expect(prependItemsMock).toHaveBeenCalledWith(previousExpectedFirstDisplayedItem, expect.anything(), numberOfItemsAddedToTop * itemHeight)

                expectedScrolledRatio -= numberOfItemsAddedToTop * itemHeight * scrollRatio;
                // a 'wrong' scrolled ratio should have been emitted
                await assertScrolledRatio();

                // because the items have been added to the top,
                // a new scroll top is set
                vi.advanceTimersByTime(200);
                changeScrollTop(numberOfItemsAddedToTop * itemHeight);
                displayedData.setScrollTop(scrollTop);

                // the 'right' scrolled ratio should have been emitted
                await assertScrolledRatio();
            }
        }

        function changeScrollTop(scrollTopDifference: number) {
            scrollTop += scrollTopDifference;
            expectedScrolledRatio += scrollTopDifference * scrollRatio
        }
    })

    it('should scroll to position', async () => {
        const totalNumberOfItems = 10 ** 4;
        const itemHeight = 10;
        const numbers = createNumbersForVeryLongList({
            numberOfItems: totalNumberOfItems,
            initialNumberOfItems: 1
        });
        const display = createNumberDisplay();
        numbers.getRelativePositionOfItemMock.resolveAllCalls((item: number) => numbers.getRelativePositionOfItem(item));
        numbers.getItemsBeforeItemMock.resolveAllCalls((item, numberOfItems) => numbers.getItemsBeforeItem(item, numberOfItems))
        numbers.getItemsAfterItemMock.resolveAllCalls((item, numberOfItems) => numbers.getItemsAfterItem(item, numberOfItems));
        numbers.getItemsAtRelativePositionMock.resolveAllCalls((position, numberOfItems) => numbers.getItemsAtRelativePosition(position, numberOfItems))
        display.getDisplayedHeightMock.resolveAllCalls(() => itemHeight);

        let latestScrolledRatio: ScrolledRatioChangedEvent['detail'] | undefined;

        const abortController = new AbortController();
        const displayedData = DisplayedData.create(
            numbers.data,
            display.contentDisplay,
            100,
            abortController.signal
        );

        displayedData.addEventListener('scrolledratiochanged', ({ detail }) => latestScrolledRatio = detail);

        await expect.poll(() => display.displayedItems).toEqual(numberSequence(0, 29));

        const positionToScrollTo = .5;
        const numberOfItemsDisplayedAboveScrollTop = 20;

        await displayedData.scrollToPosition(positionToScrollTo);

        expect(display.displayedItems).toEqual(numberSequence(5000 - numberOfItemsDisplayedAboveScrollTop, 5029));

        // a 'wrong' scrolled ratio should have been emitted
        expect(latestScrolledRatio).toEqual({ scrolledRatio: positionToScrollTo - numberOfItemsDisplayedAboveScrollTop * 1 / totalNumberOfItems });

        // because the items have been added to the top,
        // a new scroll top is set
        displayedData.setScrollTop(itemHeight * numberOfItemsDisplayedAboveScrollTop);

        await expect.poll(() => latestScrolledRatio).toEqual({ scrolledRatio: positionToScrollTo })
    })
})

function createNumbersForVeryLongList({ numberOfItems: totalNumberOfItems, initialNumberOfItems }: NumbersForVeryLongListInit): NumbersForVeryLongList {
    const items = numberSequence(0, initialNumberOfItems - 1);
    const lastItem = totalNumberOfItems - 1;
    const getRelativePositionOfItemMock: AsyncFn<[number], number> = asyncFn();
    const getItemsAtRelativePositionMock: AsyncFn<[number, number], VeryLongListItems<number>> = asyncFn();
    const getItemsAfterItemMock: AsyncFn<[number, number], VeryLongListItems<number>> = asyncFn();
    const getItemsBeforeItemMock: AsyncFn<[number, number], VeryLongListItems<number>> = asyncFn();

    return {
        getRelativePositionOfItemMock,
        getRelativePositionOfItem,
        getItemsAtRelativePositionMock,
        getItemsAtRelativePosition,
        getItemsAfterItemMock,
        getItemsAfterItem,
        getItemsBeforeItemMock,
        getItemsBeforeItem,
        data: {
            items: {
                items,
                hasPrevious: false,
                hasNext: true
            },
            total: {
                getRelativePositionOfItem: getRelativePositionOfItemMock,
                getItemsAtRelativePosition: getItemsAtRelativePositionMock
            },
            getItemsAfterItem: getItemsAfterItemMock,
            getItemsBeforeItem: getItemsBeforeItemMock,
            renderItem: vi.fn()
        }
    }


    function getRelativePositionOfItem(item: number): number {
        return item / totalNumberOfItems;
    }

    function getItemsAfterItem(item: number, numerOfItems: number): VeryLongListItems<number> {
        const first = item + 1;
        const last = Math.min(item + numerOfItems, lastItem);
        const hasPrevious = true;
        const hasNext = last < lastItem;
        return { items: numberSequence(first, last), hasPrevious, hasNext }
    }

    function getItemsBeforeItem(item: number, numberOfItems: number): VeryLongListItems<number> {
        const first = Math.max(0, item - numberOfItems);
        const last = item - 1;
        const hasPrevious = first > 0;
        const hasNext = true;
        return { items: numberSequence(first, last), hasPrevious, hasNext }
    }

    function getItemsAtRelativePosition(position: number, numberOfItems: number): VeryLongListItems<number> {
        const first = Math.floor(totalNumberOfItems * position);
        const last = Math.min(first + numberOfItems - 1, lastItem);
        const hasPrevious = first > 0;
        const hasNext = last < lastItem;
        return { items: numberSequence(first, last), hasPrevious, hasNext }
    }
}

function createNumberDisplay(): NumberDisplay {
    const displayedItems: number[] = [];
    const prependItemsMock = vi
        .fn<(referenceItem: number, items: number[], totalHeight: number) => Promise<DisplayedItem<number, number>[]>>()
        .mockImplementation((referenceItem, items) => {
            return prependItems(referenceItem, items);
        });
    const getDisplayedHeightMock = asyncFn<[number], number>();

    return {
        displayedItems,
        getDisplayedHeightMock,
        prependItemsMock,
        contentDisplay: {
            appendItems,
            prependItems: prependItemsMock,
            removeDisplayedItem,
            getDisplayedHeight: getDisplayedHeightMock
        }
    }

    function appendItems(items: number[]): DisplayedItem<number, number>[] {
        displayedItems.push(...items);
        return items.map(n => ({ item: n, displayed: n }))
    }

    function removeDisplayedItem(item: number): void {
        const index = displayedItems.indexOf(item);
        displayedItems.splice(index, 1);
    }

    function prependItems(referenceItem: number, items: number[]): Promise<DisplayedItem<number, number>[]> {
        const index = displayedItems.indexOf(referenceItem);
        displayedItems.splice(index, 0, ...items);
        return Promise.resolve(items.map(n => ({ item: n, displayed: n })))
    }
}

interface ScrolledUpVerification {
    scrollTopChange: number
    numberOfItemsRemovedFromBottom?: number
    numberOfItemsAddedToTop?: number
}
interface ScrolledDownVerification {
    scrollTopChange: number
    numberOfItemsRemovedFromTop?: number
    numberOfItemsAddedToBottom?: number
}
interface NumberDisplay {
    displayedItems: number[]
    getDisplayedHeightMock: AsyncFn<[number], number>
    prependItemsMock: Mock<(referenceItem: number, items: number[], totalHeight: number) => Promise<DisplayedItem<number, number>[]>>
    contentDisplay: ContentDisplay<number, number>
}
interface NumbersForVeryLongListInit {
    numberOfItems: number
    initialNumberOfItems: number
}
interface NumbersForVeryLongList {
    getRelativePositionOfItemMock: AsyncFn<[number], number>
    getRelativePositionOfItem(item: number): number
    getItemsAtRelativePositionMock: AsyncFn<[number, number], VeryLongListItems<number>>
    getItemsAtRelativePosition(position: number, nrOfItems: number): VeryLongListItems<number>
    getItemsAfterItemMock: AsyncFn<[number, number], VeryLongListItems<number>>
    getItemsAfterItem(item: number, numerOfItems: number): VeryLongListItems<number>
    getItemsBeforeItemMock: AsyncFn<[number, number], VeryLongListItems<number>>
    getItemsBeforeItem(item: number, numberOfItems: number): VeryLongListItems<number>
    data: VeryLongListData<number>
}

function numberSequence(from: number, to: number): number[] {
    const items: number[] = [];
    for(let n = from; n <= to; n++){
        items.push(n)
    }
    return items;
}
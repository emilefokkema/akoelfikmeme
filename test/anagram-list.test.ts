import { describe, it, expect, beforeEach } from "vitest";
import { AnagramList } from '../src/worker/anagram-list'
import type { AnagramListItemData } from "../src/shared/anagram-list-messages";

describe('anagram list', () => {
    let anagramList: AnagramList

    beforeEach(() => {
        anagramList = new AnagramList();
        anagramList.setElements(["a", "n", "a", "g", "r", "a", "m"])
    })

    describe('that gets items', () => {
        let items: AnagramListItemData

        beforeEach(() => {
            items = anagramList.getItems({ maxItems: 1});
        })

        it('should get items', () => {
            const { items: itemList, hasNext, hasPrevious } = items;
            expect(hasPrevious).toBe(false)
            expect(hasNext).toBe(true)
            expect(itemList.map(i => i.elements)).toMatchSnapshot();
        })

        describe('and then gets items after item', () => {
            let nextItems: AnagramListItemData

            beforeEach(() => {
                const { items: [firstItem] } = items;
                nextItems = anagramList.getItemsAfterItem({ item: firstItem, maxItems: 5});
            })

            it('should get items after item', () => {
                const { items: nextItemList} = nextItems
                expect(nextItemList.map(i => i.elements)).toMatchSnapshot();
            })

            describe('and then gets items before item', () => {
                let previousItems: AnagramListItemData

                beforeEach(() => {
                    const { items: nextItemList} = nextItems
                    previousItems = anagramList.getItemsBeforeItem({ item: nextItemList[4], maxItems: 3})
                })

                it('should get items before item', () => {
                    const { items: prevousItemList } = previousItems;
                    expect(prevousItemList.map(i => i.elements)).toMatchSnapshot();
                })
            })
        })
    })

    describe('that gets items at relative position', () => {
        let items: AnagramListItemData

        beforeEach(() => {
            items = anagramList.getItemsAtRelativePosition({ relativePosition: .5, maxItems: 5});
        })

        it('should get items', () => {
            const { items: itemList, hasNext, hasPrevious } = items;
            expect(hasPrevious).toBe(true)
            expect(hasNext).toBe(true)
            expect(itemList.map(i => i.elements)).toMatchSnapshot();
        })
    })
})
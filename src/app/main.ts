import './anagram-table';
import type { AnagramTableData } from './anagram-table';

function initialize(): void {
    const input = document.querySelector('input')!;
    const table = document.querySelector('anagram-table')!
    input.addEventListener('input', () => {
        console.log('there is input')
    })
    const totalItems = 10**4;
    const tableData: AnagramTableData<number> = {
        items: {
            items: [5000],
            hasNext: true,
            hasPrevious: true
        },
        getItemsAfterItem(item, nrOfItems) {
            const result: number[] = [];
            let itemsAdded = 0;
            let currentItem = item;
            while(itemsAdded < nrOfItems && currentItem <= totalItems - 1){
                currentItem++;
                result.push(currentItem);
                itemsAdded++;
            }
            return Promise.resolve({
                items: result,
                hasNext: currentItem < totalItems,
                hasPrevious: true
            });
        },
        getItemsBeforeItem(item, nrOfItems) {
            const result: number[] = [];
            let itemsAdded = 0;
            let currentItem = item;
            while(itemsAdded < nrOfItems && currentItem >= 1){
                currentItem--;
                result.unshift(currentItem);
                itemsAdded++;
            }
            return Promise.resolve({
                items: result,
                hasNext: true,
                hasPrevious: currentItem > 0
            });
        },
        renderItem(item) {
            const span = document.createElement('span');
            span.textContent = `${item}`;
            return span;
        },
    }
    table.setData(tableData);
}

initialize();


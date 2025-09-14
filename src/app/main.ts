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
        item: 1,
        hasItemsAfterItem(item) {
            return Promise.resolve(item < totalItems);
        },
        getItemsAfterItem(item, nrOfItems) {
            const result: number[] = [];
            let itemsAdded = 0;
            let currentItem = item + 1;
            while(itemsAdded < nrOfItems && currentItem <= totalItems){
                result.push(currentItem);
                itemsAdded++;
                currentItem++;
            }
            return Promise.resolve(result);
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


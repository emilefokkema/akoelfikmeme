import './anagram-table';
import type { AnagramTableData } from './anagram-table';

function initialize(): void {
    const input = document.querySelector('input')!;
    const table = document.querySelector('anagram-table')!
    input.addEventListener('input', () => {
        console.log('there is input')
    })
    const tableData: AnagramTableData<number> = {
        item: 1,
        hasItemsAfterItem(item) {
            return Promise.resolve(item < 100);
        },
        getItemsAfterItem(item, nrOfItems) {
            const result: number[] = [];
            for(let newNumber = item + 1; newNumber <= 100; newNumber++){
                result.push(newNumber);
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


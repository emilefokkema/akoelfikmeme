import { createAnagramList } from './anagram-list';
import './very-long-list';

async function initialize(): Promise<void> {
    const anagramList = createAnagramList();
    const input = document.querySelector('input')!;
    const veryLongList = document.querySelector('very-long-list')!;

    input.addEventListener('input', () => {
        console.log('there is input')
    });
    const anagramListData = await anagramList.getListData();
    veryLongList.setData(anagramListData);
}

initialize();


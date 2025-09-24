import { createAnagramList } from './anagram-list';
import './very-long-list';

async function initialize(): Promise<void> {
    const anagramList = createAnagramList();
    const input = document.querySelector('input')!;
    const veryLongList = document.querySelector('very-long-list')!;

    input.addEventListener('input', async () => {
        const abortController = new AbortController();
        console.log('sending request to worker...')
        const result = await anagramList.setElements(['a', 'b'], abortController.signal);
        console.log('got result from worker', result)
    });
    const anagramListData = await anagramList.getListData();
    veryLongList.setData(anagramListData);
}

initialize();


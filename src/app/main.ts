import { createAnagramList } from './anagram-list';
import './very-long-list';
import './anagram-input';
import { throttledWithAbort } from './throttled-with-abort';

async function initialize(): Promise<void> {
    const anagramList = createAnagramList();
    const input = document.querySelector('anagram-input')!;
    const veryLongList = document.querySelector('very-long-list')!;

    input.addEventListener('input', throttledWithAbort(async (abortSignal) => {
        console.log('sending request to worker...');
        const result = await anagramList.setElements(input.value, abortSignal);
        console.log('got result from worker', result)
        if(abortSignal.aborted){
            return;
        }
        const anagramListData = await anagramList.getListData();
        if(abortSignal.aborted){
            return;
        }
        veryLongList.setData(anagramListData);
    }, 300));
}

initialize();


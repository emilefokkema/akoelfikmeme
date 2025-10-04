import { createAnagramList } from './anagram-list';
import './very-long-list';
import './anagram-input';
import { throttledWithAbort } from './throttled-with-abort';

async function initialize(): Promise<void> {
    const anagramList = createAnagramList();
    const input = document.querySelector('anagram-input')!;
    const veryLongList = document.querySelector('very-long-list')!;

    input.addEventListener('input', throttledWithAbort(async (abortSignal) => {
        const result = await anagramList.setElements(input.value, abortSignal);
        if(abortSignal.aborted){
            return;
        }
        const anagramListData = await anagramList.getListData(abortSignal);
        if(abortSignal.aborted){
            return;
        }
        veryLongList.setData(anagramListData);
    }, 300));
}

initialize();


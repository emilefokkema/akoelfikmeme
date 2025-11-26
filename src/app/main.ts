import { createAnagramList } from './anagram-list';
import './very-long-list';
import './anagram-input';
import { debounceWithAbort } from './utils';

async function initialize(): Promise<void> {
    const anagramList = createAnagramList();
    const input = document.querySelector('anagram-input')!;
    const veryLongList = document.querySelector('very-long-list')!;

    input.addEventListener('input', debounceWithAbort(async (abortSignal) => {
        await anagramList.setElements(input.value, abortSignal);
        if(abortSignal.aborted){
            return;
        }
        const anagramListData = await anagramList.getListData(abortSignal);
        if(abortSignal.aborted){
            return;
        }
        veryLongList.setData(anagramListData, abortSignal);
    }, 300));
}

initialize();


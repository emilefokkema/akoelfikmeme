import type { AnagramElements, AnagramListClient, AnagramListItem, AnagramListItemData, ContinuationRequest } from "../shared/anagram-list-messages";
import { PermutationList, type Permutation, type PermutationValue } from "../permutator/permutation-list"

interface ElementsPermutation {
    permutationValue: PermutationValue
    elementMap: Map<number, string>
}
function createElementsPermutation(elements: AnagramElements): ElementsPermutation {
    const availableIndices: number[] = Array.apply(null, new Array(elements.length)).map((_, index) => index);
    const indicesMap = new Map<string, number>();
    const elementMap = new Map<number, string>();
    const permutationValue: number[] = [];
    for(const element of elements){
        let index: number;
        if(indicesMap.has(element)){
            index = indicesMap.get(element)!;
        }else{
            const randomIndexIndex = Math.floor(Math.random() * availableIndices.length);
            ([index] = availableIndices.splice(randomIndexIndex, 1));
            indicesMap.set(element, index);
            elementMap.set(index, element);
        }
        permutationValue.push(index);
    }
    return {
        permutationValue,
        elementMap
    }
}

const empty = {
    items: [],
    hasNext: false,
    hasPrevious: false
}
export class AnagramList implements AnagramListClient {
    private permutationList: PermutationList | undefined
    private elementMap: Map<number, string> | undefined;
    private initialPermutation: PermutationValue | undefined
    public setElements(elements: AnagramElements): void {
        if(elements.length === 0){
            this.permutationList = undefined;
            this.elementMap = undefined;
            this.initialPermutation = undefined;
            return;
        }
        
        const {permutationValue, elementMap} = createElementsPermutation(elements);
        this.permutationList = new PermutationList(permutationValue);
        this.elementMap = elementMap;
        this.initialPermutation = permutationValue;
    }
    public getItems(): AnagramListItemData | undefined {
        if(!this.initialPermutation || !this.permutationList || !this.elementMap){
            return undefined;
        }
        const perm = this.permutationList.getPermutation(this.initialPermutation);
        if(!perm){
            return undefined;
        }
        const elementMap = this.elementMap;
        const nextPerm = perm.next();
        const previousPerm = perm.previous();
        console.log('current is', perm)
        console.log('previous is', previousPerm)
        return {
            items: [
                {
                    elements: perm.value.map(e => elementMap.get(e)!),
                    permutation: perm.value
                }
            ],
            hasNext: !!nextPerm,
            hasPrevious: !!previousPerm
        }
    }
    public getItemsAfterItem({item, maxItems}: ContinuationRequest): AnagramListItemData {
        if(!this.permutationList || !this.elementMap){
            return empty;
        }
        const permutation = this.permutationList.getPermutation(item.permutation);
        if(!permutation){
            return empty;
        }
        const previous = permutation.previous();
        let currentPermutation = permutation;
        let nextPermutation: Permutation | undefined;
        let numberOfItemsFound = 0;
        const resultingItems: AnagramListItem[] = [];
        const elementMap = this.elementMap;
        while(true){
            nextPermutation = currentPermutation.next();
            if(numberOfItemsFound >= maxItems || !nextPermutation){
                break;
            }
            resultingItems.push({
                permutation: nextPermutation.value,
                elements: nextPermutation.value.map(e => elementMap.get(e)!)
            });
            numberOfItemsFound++;
            currentPermutation = nextPermutation;
        }
        return {
            items: resultingItems,
            hasPrevious: !!previous,
            hasNext: !!nextPermutation
        }
    }
    public getItemsBeforeItem({item, maxItems}: ContinuationRequest): AnagramListItemData {
        if(!this.permutationList || !this.elementMap){
            return empty;
        }
        const permutation = this.permutationList.getPermutation(item.permutation);
        if(!permutation){
            return empty;
        }
        const next = permutation.next();
        let currentPermutation = permutation;
        let previousPermutation: Permutation | undefined;
        let numberOfItemsFound = 0;
        const resultingItems: AnagramListItem[] = [];
        const elementMap = this.elementMap;
        while(true){
            previousPermutation = currentPermutation.previous();
            if(numberOfItemsFound >= maxItems || !previousPermutation){
                break;
            }
            resultingItems.unshift({
                permutation: previousPermutation.value,
                elements: previousPermutation.value.map(e => elementMap.get(e)!)
            });
            numberOfItemsFound++;
            currentPermutation = previousPermutation;
        }
        return {
            items: resultingItems,
            hasPrevious: !!previousPermutation,
            hasNext: !!next
        }
    }
}
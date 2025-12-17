import type { AnagramElements, AnagramListClient, AnagramListItem, AnagramListItemData, ContinuationRequest, ItemsAtRelativePositionRequest, ItemsRequest } from "../shared/anagram-list-messages";
import { PermutationList, type Permutation, type PermutationValue } from "../permutator/permutation-list"

interface ElementsPermutation {
    permutationValue: PermutationValue
    elementMap: Map<number, string>
}
function createElementsPermutation(elements: AnagramElements): ElementsPermutation {
    let currentIndex = 0;
    const indicesMap = new Map<string, number>();
    const elementMap = new Map<number, string>();
    const permutationValue: number[] = [];
    for(const element of elements){
        let index: number;
        if(indicesMap.has(element)){
            index = indicesMap.get(element)!;
        }else{
            index = currentIndex++;
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
    public getItems({ maxItems }: ItemsRequest): AnagramListItemData {
        if(!this.initialPermutation || !this.permutationList || !this.elementMap){
            return empty;
        }
        const perm = this.permutationList.getPermutation(this.initialPermutation);
        if(!perm){
            return empty;
        }

        return this.getItemsFromPermutation(perm, maxItems);
    }
    public getItemsAtRelativePosition({ relativePosition, maxItems }: ItemsAtRelativePositionRequest){
        if(!this.permutationList){
            return empty;
        }
        const atPosition = this.permutationList.getPermutationAtRelativePosition(relativePosition);
        if(!atPosition){
            return empty;
        }
        return this.getItemsFromPermutation(atPosition, maxItems);
    }
    public getItemsAfterItem({item, maxItems}: ContinuationRequest): AnagramListItemData {
        if(!this.permutationList || !this.elementMap){
            return empty;
        }
        const permutation = this.permutationList.getPermutation(item.permutation);
        if(!permutation){
            return empty;
        }
        const next = permutation.next();
        if(!next){
            return empty;
        }
        return this.getItemsFromPermutation(next, maxItems);
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
    public getRelativePositionOfItem(item: AnagramListItem): number {
        if(!this.permutationList){
            return 0;
        }
        const permutation = this.permutationList.getPermutation(item.permutation);
        if(!permutation){
            return 0;
        }
        return permutation.getPosition();
    }
    private getItemsFromPermutation(permutation: Permutation, maxItems: number): AnagramListItemData {
        if(!this.elementMap){
            return empty;
        }
        const previous = permutation.previous();
        let currentPermutation = permutation;
        let nextPermutation: Permutation | undefined;
        let numberOfItemsFound = 0;
        const resultingItems: AnagramListItem[] = [];
        const elementMap = this.elementMap;
        while(true){
            if(numberOfItemsFound >= maxItems){
                break;
            }
            // nextPermutation = currentPermutation.next();
            // if(numberOfItemsFound >= maxItems || !nextPermutation){
            //     break;
            // }
            resultingItems.push({
                permutation: currentPermutation.value,
                elements: currentPermutation.value.map(e => elementMap.get(e)!)
            });
            numberOfItemsFound++;
            nextPermutation = currentPermutation.next();
            if(!nextPermutation){
                break;
            }
            currentPermutation = nextPermutation;
        }
        return {
            items: resultingItems,
            hasPrevious: !!previous,
            hasNext: !!nextPermutation
        }
    }
}
type PermutationIndex = readonly number[];
export type PermutationValue = readonly number[];


export interface Permutation {
    readonly value: PermutationValue
    previous(): Permutation | undefined
    next(): Permutation | undefined
    getPosition(): number
}

class UniqueValuePermutation {
    constructor(public readonly index: PermutationIndex){}

    previous(): UniqueValuePermutation | undefined {
        const descendingTail: number[] = [];
        let indexStartNew = this.index.length - 1;
        let currentNumber: number | undefined;
        let firstHigher: number | undefined;
        while(true){
            const newNumber = this.index[indexStartNew];
            if(currentNumber !== undefined && newNumber > currentNumber){
                firstHigher = newNumber;
                break;
            }
            descendingTail.push(newNumber);
            currentNumber = newNumber;
            if(indexStartNew === 0){
                break;
            }
            indexStartNew--;
        }
        if(firstHigher === undefined){
            return undefined;
        }
        const newNumbers: number[] = new Array(this.index.length);
        for(let index = 0; index < indexStartNew; index++){
            newNumbers[index] = this.index[index];
        }
        let lowerFound = false;
        for(let index = 0; index < descendingTail.length; index++){
            const tailNumber = descendingTail[index];
            if(tailNumber < firstHigher && !lowerFound){
                newNumbers[indexStartNew] = tailNumber;
                newNumbers[indexStartNew + index + 1] = firstHigher;
                lowerFound = true;
                continue;
            }
            newNumbers[indexStartNew + index + 1] = tailNumber;
        }
        return new UniqueValuePermutation(newNumbers);
    }

    next(): UniqueValuePermutation | undefined {
        const ascendingTail: number[] = [];
        let indexStartNew = this.index.length - 1;
        let currentNumber: number | undefined;
        let firstLower: number | undefined;
        while(true){
            const newNumber = this.index[indexStartNew];
            if(currentNumber !== undefined && newNumber < currentNumber){
                firstLower = newNumber;
                break;
            }
            ascendingTail.push(newNumber);
            currentNumber = newNumber;
            if(indexStartNew === 0){
                break;
            }
            indexStartNew--;
        }
        if(firstLower === undefined){
            return undefined;
        }
        const newNumbers: number[] = new Array(this.index.length);
        for(let index = 0; index < indexStartNew; index++){
            newNumbers[index] = this.index[index];
        }
        let higherFound = false;
        for(let index = 0; index < ascendingTail.length; index++){
            const tailNumber = ascendingTail[index];
            if(tailNumber > firstLower && !higherFound){
                newNumbers[indexStartNew] = tailNumber;
                newNumbers[indexStartNew + index + 1] = firstLower;
                higherFound = true;
                continue;
            }
            newNumbers[indexStartNew + index + 1] = tailNumber;
        }
        return new UniqueValuePermutation(newNumbers);
    }

    static earliestStartingWith(size: number, index: PermutationIndex): UniqueValuePermutation | undefined {
        const allNumbers = Array.apply(null, new Array(size)).map((_, index) => index);
        const result: number[] = [];
        for(const indexNumber of index){
            const numberIndex = allNumbers.indexOf(indexNumber);
            if(numberIndex === -1){
                return undefined;
            }
            allNumbers.splice(numberIndex, 1);
            result.push(indexNumber);
        }
        if(allNumbers.length > 0){
            result.splice(result.length, 0, ...allNumbers);
        }
        return new UniqueValuePermutation(result);
    }

    static latestStartingWith(size: number, index: PermutationIndex): UniqueValuePermutation | undefined {
        const allNumbers = Array.apply(null, new Array(size)).map((_, index) => size - 1 - index);
        const result: number[] = [];
        for(const indexNumber of index){
            const numberIndex = allNumbers.indexOf(indexNumber);
            if(numberIndex === -1){
                return undefined;
            }
            allNumbers.splice(numberIndex, 1);
            result.push(indexNumber);
        }
        if(allNumbers.length > 0){
            result.splice(result.length, 0, ...allNumbers);
        }
        return new UniqueValuePermutation(result);
    }
}

function createValueMap(values: PermutationValue): PermutableValue[] {
    const result: PermutableValue[] = new Array(values.length);
    const duplicateIndicesMap = new Map<number, number[]>();
    for(let index = 0; index < values.length; index++){
        const value = values[index];
        const duplicateIndices: number[] = duplicateIndicesMap.get(value) || [];
        duplicateIndices.push(index);
        duplicateIndicesMap.set(value, duplicateIndices)
        result[index] = {
            value,
            duplicateIndices
        }
    }
    for(let index = 0; index < values.length; index++){
        const {value, duplicateIndices} = result[index];
        result[index] = {
            value,
            duplicateIndices: duplicateIndices && duplicateIndices.length > 1
                ? duplicateIndices.filter(v => v !== index)
                : undefined
        }
    }
    return result;
}

class PermutationImpl implements Permutation {
    constructor(
        public readonly value: PermutationValue,
        private readonly permutation: UniqueValuePermutation,
        private readonly valueMap: ValueMap
    ){}

    private findIndexOfDuplication(permutation: UniqueValuePermutation): number {
        const values = permutation.index;
        const valuesSeen: number[] = [];
        let result = -1;
        for(let index = values.length - 1; index >= 0; index--){
            const permValueAtIndex = values[index];
            if(this.valueMap.hasDuplicateIndexAt(permValueAtIndex, i => i < permValueAtIndex && valuesSeen.includes(i))){
                result = index;
            }
            valuesSeen.push(permValueAtIndex)
        }
        return result;
    }

    private getNextWithoutDuplicates(permutation: UniqueValuePermutation): UniqueValuePermutation | undefined {
        let candidate = permutation;
        let indexOfDuplication: number;
        while((indexOfDuplication = this.findIndexOfDuplication(candidate)) > -1){
            const nextCandidate = UniqueValuePermutation
                .latestStartingWith(
                    candidate.index.length,
                    candidate.index.slice(0, indexOfDuplication + 1)
                )!
                .next();
            if(!nextCandidate){
                return undefined;
            }
            candidate = nextCandidate;
        }
        return candidate;
    }

    private getPreviousWithoutDuplicates(permutation: UniqueValuePermutation): UniqueValuePermutation | undefined {
        let candidate = permutation;
        let indexOfDuplication: number;
        while((indexOfDuplication = this.findIndexOfDuplication(candidate)) > -1){
            const nextCandidate = UniqueValuePermutation
                .earliestStartingWith(
                    candidate.index.length,
                    candidate.index.slice(0, indexOfDuplication + 1)
                )!
                .previous();
            if(!nextCandidate){
                return undefined;
            }
            candidate = nextCandidate;
        }
        return candidate;
    }

    next(): Permutation | undefined {
        let uniquePermutationNext = this.permutation.next();
        if(!uniquePermutationNext){
            return undefined;
        }
        uniquePermutationNext = this.getNextWithoutDuplicates(uniquePermutationNext);
        if(!uniquePermutationNext){
            return undefined;
        }
        return PermutationImpl.fromUniquePermutation(uniquePermutationNext, this.valueMap);
    }

    previous(): Permutation | undefined {
        let uniquePermutationPrevious = this.permutation.previous();
        if(!uniquePermutationPrevious){
            return undefined;
        }
        uniquePermutationPrevious = this.getPreviousWithoutDuplicates(uniquePermutationPrevious);
        if(!uniquePermutationPrevious){
            return undefined;
        }
        return PermutationImpl.fromUniquePermutation(uniquePermutationPrevious, this.valueMap);
    }

    getPosition(): number {
        const uniqueIndexValues = this.permutation.index;
        let result = 0;
        let currentSectionSize = 1;
        let valueMap = this.valueMap;
        let indicesInValueMap: (number | undefined)[] = Array.apply(null, new Array(valueMap.size)).map((_, i) => i);
        for(let uniqueIndexValueIndex = 0; uniqueIndexValueIndex < uniqueIndexValues.length; uniqueIndexValueIndex++){
            const uniqueIndexValue = uniqueIndexValues[uniqueIndexValueIndex];
            const indexInValueMap = indicesInValueMap[uniqueIndexValue];
            if(indexInValueMap === undefined){
                continue;
            }
            const positionOfIndex = valueMap.getPositionOfIndex(indexInValueMap);
            result += currentSectionSize * positionOfIndex;
            currentSectionSize *= valueMap.getSizeOfIndex(indexInValueMap);
            const newValueMap = valueMap.withoutIndex(indexInValueMap);
            if(!newValueMap){
                break;
            }
            valueMap = newValueMap;
            indicesInValueMap = indicesInValueMap.map(i => i === undefined || i === indexInValueMap ? undefined : i > indexInValueMap ? i - 1 : i);
        }
        return result;
    }

    private static fromUniquePermutation(permutation: UniqueValuePermutation, valueMap: ValueMap): PermutationImpl {
        const permValues = permutation.index;
        const length = permValues.length;
        
        const nextValues: number[] = new Array(length);
        for(let index = 0; index < length; index++){
            const permValueAtIndex = permValues[index];
            nextValues[index] = valueMap.valueAt(permValueAtIndex);
        }

        return new PermutationImpl(nextValues, permutation, valueMap);
    }
}

interface PermutableValue {
    value: number
    duplicateIndices: number[] | undefined
}

class ValueMap {
    public readonly size: number

    constructor(
        private readonly permutableValues: PermutableValue[]
    ){
        this.size = permutableValues.length;
    }

    valueAt(index: number): number {
        return this.permutableValues[index].value;
    }
    hasDuplicateIndexAt(index: number, predicate: (duplicate: number) => boolean): boolean {
        const duplicateIndices = this.permutableValues[index].duplicateIndices;
        if(!duplicateIndices){
            return false;
        }
        return duplicateIndices.some(predicate);
    }
    getSizeOfIndex(index: number): number {
        const values = this.permutableValues[index];
        if(!values){
            return 0;
        }
        const duplicates = values.duplicateIndices;
        if(!duplicates){
            return 1 / this.size;
        }
        return ( 1 + duplicates.length ) / this.size;
    }
    getPositionOfIndex(index: number): number {
        let result = 0;
        const indicesSeen = new Set<number>();
        for(let i = 0; i < index; i++){
            if(indicesSeen.has(i)){
                continue;
            }
            result += this.getSizeOfIndex(i);
            indicesSeen.add(i);
            const duplicates = this.permutableValues[i].duplicateIndices;
            if(!duplicates){
                continue;
            }
            for(const duplicate of duplicates){
                indicesSeen.add(duplicate);
            }
        }
        return result;
    }
    *getIndicesByValue(value: number): Iterable<number> {
        for(let index = 0; index < this.permutableValues.length; index++){
            const {value: valueAtIndex} = this.permutableValues[index];
            if(valueAtIndex !== value){
                continue;
            }
            yield index;
        }
    }
    withoutIndex(index: number): ValueMap | undefined {
        if(index >= this.size){
            return this;
        }
        if(this.size === 1){
            return undefined;
        }
        const newSize = this.size - 1;
        const permutableValues: PermutableValue[] = new Array(newSize);
        for(let newIndex = 0; newIndex < newSize; newIndex++){
            const indexInThis = newIndex < index ? newIndex : newIndex + 1;
            const {value, duplicateIndices} = this.permutableValues[indexInThis];
            const newDuplicateIndices = duplicateIndices 
                ? duplicateIndices
                    .filter(i => i !== index)
                    .map(i => i < index ? i : i - 1)
                : undefined
            permutableValues[newIndex] = {
                value,
                duplicateIndices: newDuplicateIndices
                    ? newDuplicateIndices.length > 0
                        ? newDuplicateIndices
                        : undefined
                    : undefined
            }
        }
        return new ValueMap(permutableValues)
    }

    static create(permutationValue: PermutationValue): ValueMap {
        const permutableValues: PermutableValue[] = new Array(permutationValue.length);
        const duplicateIndicesMap = new Map<number, number[]>();
        for(let index = 0; index < permutationValue.length; index++){
            const value = permutationValue[index];
            const duplicateIndices: number[] = duplicateIndicesMap.get(value) || [];
            duplicateIndices.push(index);
            duplicateIndicesMap.set(value, duplicateIndices)
            permutableValues[index] = {
                value,
                duplicateIndices
            }
        }
        for(let index = 0; index < permutationValue.length; index++){
            const {value, duplicateIndices} = permutableValues[index];
            permutableValues[index] = {
                value,
                duplicateIndices: duplicateIndices && duplicateIndices.length > 1
                    ? duplicateIndices.filter(v => v !== index)
                    : undefined
            }
        }
        return new ValueMap(permutableValues);
    }
}
export class PermutationList {
    private readonly valueMap: ValueMap
    constructor(value: PermutationValue){
        this.valueMap = ValueMap.create(value)
    }

    getPermutation(values: PermutationValue): Permutation | undefined {
        const indices: number[] = new Array(values.length);
        const indicesUsed = new Set<number>();
        first:for(let valueIndex = 0; valueIndex < values.length; valueIndex++){
            const value = values[valueIndex];
            for(const index of this.valueMap.getIndicesByValue(value)){
                if(indicesUsed.has(index)){
                    continue;
                }
                indices[valueIndex] = index;
                indicesUsed.add(index);
                continue first;
            }
            return undefined;
        }
        const uniqueValuePermutation = UniqueValuePermutation.earliestStartingWith(this.valueMap.size, indices);
        if(!uniqueValuePermutation){
            return undefined;
        }
        const valuesToUse = uniqueValuePermutation.index.map(i => this.valueMap.valueAt(i))
        return new PermutationImpl(valuesToUse, uniqueValuePermutation, this.valueMap)
    }
}
export type PermutationIndex = readonly number[];

export interface Permutation {
    readonly index: PermutationIndex
    previous(): Permutation | undefined
    next(): Permutation | undefined
}

export class PermutationList {
    constructor(private readonly numberOfElements: number){}

    getAtIndex(index: PermutationIndex): Permutation | undefined {
        return PermutationImpl.tryCreate(this.numberOfElements, index)
    }
}

class PermutationImpl implements Permutation {
    constructor(public readonly index: PermutationIndex){}

    previous(): Permutation | undefined {
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
        return new PermutationImpl(newNumbers);
    }

    next(): Permutation | undefined {
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
        return new PermutationImpl(newNumbers);
    }

    static tryCreate(size: number, index: PermutationIndex): PermutationImpl | undefined {
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
        return new PermutationImpl(result);
    }
}
import { describe, it, expect } from 'vitest'
import { PermutationList, type Permutation } from '../src/permutator/permutation-list'

describe('permutator', () => {

    it('a permutation should have numbers', () => {
        expect(new PermutationList(1).getAtIndex([0])?.index).toEqual([0])
        expect(new PermutationList(1).getAtIndex([])?.index).toEqual([0]);
        expect(new PermutationList(1).getAtIndex([1])).toBeUndefined();

        expect(new PermutationList(2).getAtIndex([0])?.index).toEqual([0, 1]);
        expect(new PermutationList(2).getAtIndex([1, 0])?.index).toEqual([1, 0]);
        expect(new PermutationList(2).getAtIndex([0, 1])?.index).toEqual([0, 1]);
        expect(new PermutationList(2).getAtIndex([0])?.index).toEqual([0, 1]);
        expect(new PermutationList(2).getAtIndex([1])?.index).toEqual([1, 0]);

        expect(new PermutationList(4).getAtIndex([1, 3])?.index).toEqual([1, 3, 0, 2])
        expect(new PermutationList(4).getAtIndex([1, 4])).toBeUndefined();
    })

    it('a permutation should have no next', () => {
        expect(new PermutationList(2).getAtIndex([1, 0])?.next()).toBeUndefined();
    })

    it('a permutation should have a next', () => {
        expect(new PermutationList(2).getAtIndex([0, 1])?.next()?.index).toEqual([1, 0])
        expect(new PermutationList(3).getAtIndex([0, 1, 2])?.next()?.index).toEqual([0, 2, 1])
    })

    it.each([
        [[
            [0],
        ]],
        [[
            [0, 1],
            [1, 0]
        ]],
        [[
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0],
        ]],
        [[
            [0, 1, 2, 3],
            [0, 1, 3, 2],
            [0, 2, 1, 3],
            [0, 2, 3, 1],
            [0, 3, 1, 2],
            [0, 3, 2, 1],
            [1, 0, 2, 3],
            [1, 0, 3, 2],
            [1, 2, 0, 3],
            [1, 2, 3, 0],
            [1, 3, 0, 2],
            [1, 3, 2, 0],
            [2, 0, 1, 3],
            [2, 0, 3, 1],
            [2, 1, 0, 3],
            [2, 1, 3, 0],
            [2, 3, 0, 1],
            [2, 3, 1, 0],
            [3, 0, 1, 2],
            [3, 0, 2, 1],
            [3, 1, 0, 2],
            [3, 1, 2, 0],
            [3, 2, 0, 1],
            [3, 2, 1, 0],
        ]],
    ])('should create sequences', (list) => {
        const permutationList = new PermutationList(list[0].length);
        let currentPermutation: Permutation | undefined;
        for(let i = 0; i < list.length; i++){
            const permIndex = list[i];
            if(i === 0){
                currentPermutation = permutationList.getAtIndex(permIndex);
                expect(currentPermutation?.index).toEqual(permIndex);
            }else{
                const nextPermutation = currentPermutation?.next();
                expect(nextPermutation?.previous()?.index).toEqual(currentPermutation?.index)
                currentPermutation = nextPermutation;
                expect(currentPermutation?.index).toEqual(permIndex);
            }
        }
    })
})
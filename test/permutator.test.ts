import { describe, it, expect } from 'vitest'
import { PermutationList, type Permutation } from '../src/permutator/permutation-list'

describe('permutator', () => {

    it('a permutation should have numbers', () => {
        const listOfOne = new PermutationList([0]);
        expect(listOfOne.getPermutation([0])?.value).toEqual([0])
        expect(listOfOne.getPermutation([])?.value).toEqual([0]);
        expect(listOfOne.getPermutation([1])).toBeUndefined();

        const listOfTwo = new PermutationList([0, 1]);
        expect(listOfTwo.getPermutation([0])?.value).toEqual([0, 1]);
        expect(listOfTwo.getPermutation([1, 0])?.value).toEqual([1, 0]);
        expect(listOfTwo.getPermutation([0, 1])?.value).toEqual([0, 1]);
        expect(listOfTwo.getPermutation([1])?.value).toEqual([1, 0]);

        const listOfFour = new PermutationList([0, 1, 2, 3])
        expect(listOfFour.getPermutation([1, 3])?.value).toEqual([1, 3, 0, 2])
        expect(listOfFour.getPermutation([1, 4])).toBeUndefined();
    })

    it('a permutation should have no next', () => {
        expect(new PermutationList([0, 1]).getPermutation([1, 0])?.next()).toBeUndefined();
    })

    it('a permutation should have a next', () => {
        expect(new PermutationList([0, 1]).getPermutation([0, 1])?.next()?.value).toEqual([1, 0])
        expect(new PermutationList([0, 1, 2]).getPermutation([0, 1, 2])?.next()?.value).toEqual([0, 2, 1])
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
        [[
            [1, 1]
        ]],
        [[
            [1, 1, 1, 1]
        ]],
        [[
            [1, 2, 3, 1],
            [1, 2, 1, 3],
            [1, 3, 2, 1],
            [1, 3, 1, 2],
            [1, 1, 2, 3],
            [1, 1, 3, 2],
            [2, 1, 3, 1],
            [2, 1, 1, 3],
            [2, 3, 1, 1],
            [3, 1, 2, 1],
            [3, 1, 1, 2],
            [3, 2, 1, 1]
        ]],
        [[
            [1, 1, 2, 2, 2],
            [1, 2, 1, 2, 2],
            [1, 2, 2, 1, 2],
            [1, 2, 2, 2, 1],
            [2, 1, 1, 2, 2],
            [2, 1, 2, 1, 2],
            [2, 1, 2, 2, 1],
            [2, 2, 1, 1, 2],
            [2, 2, 1, 2, 1],
            [2, 2, 2, 1, 1]
        ]],
        [[
            [2, 3, 3],
            [3, 2, 3],
            [3, 3, 2]
        ]]
    ])('should create sequences', (list) => {
        let currentPermutation: Permutation | undefined;
        for(let i = 0; i < list.length; i++){
            const permutationValue = list[i];
            if(i === 0){
                currentPermutation = new PermutationList(permutationValue).getPermutation(permutationValue);
                expect(currentPermutation?.value).toEqual(permutationValue);
            }else{
                const nextPermutation = currentPermutation?.next();
                expect(nextPermutation?.previous()?.value).toEqual(currentPermutation?.value)
                currentPermutation = nextPermutation;
                expect(currentPermutation?.value).toEqual(permutationValue);
            }
            if(i === list.length - 1){
                expect(currentPermutation?.next()).toBeUndefined();
            }
        }
    })

    it.skip('should return the relative position of a permutation', () => {
        const list = new PermutationList([0, 1, 1, 2, 2, 2]);
        const perm1 = list.getPermutation([1, 2, 0, 1, 2, 2]);
        expect(perm1?.getPosition()).toBeCloseTo(.3); // 19th of 60
    })
})
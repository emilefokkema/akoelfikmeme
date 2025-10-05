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

    it.each([
        [[0, 1, 1, 2, 2, 2], [0, 1, 1, 2, 2, 2], 0],
        [[0, 1, 1, 2, 2, 2], [1, 2, 0, 1, 2, 2], 18 / 60], // 19th of 60
        [[0, 1, 1, 2, 2, 2], [1, 2, 0, 2, 1, 2], 19 / 60], // 19th of 60
        [[0, 1, 1, 2, 2, 2], [2, 2, 2, 1, 1, 0], 59 / 60], // 19th of 60
        [[0, 1, 2, 3, 0], [0, 1, 2, 3, 0], 0],
        [[0, 1, 2, 3, 0], [0, 0, 3, 2, 1], 23 / 60], // 24th of 60
        [[0, 1, 2, 3, 0], [1, 0, 2, 3, 0], 24 / 60], // 25th of 60
        [[0, 1, 2, 1, 3], [0, 1, 2, 1, 3], 0],
        [[0, 1, 2, 1, 3], [0, 2, 1, 3, 1], 7 / 60], // 8th of 60
        [[0, 1, 2, 1, 3], [3, 0, 2, 1, 1], 50 / 60], // 51st of 60
        [[0, 1, 2, 1, 3], [1, 3, 0, 2, 1], 30 / 60], // 31st of 60
        [[0], [0], 0],
        [[0, 1], [0, 1], 0],
        [[0, 1], [1, 0], 1 / 2],
        [[4, 1, 4, 3, 4, 5, 9, 2], [4, 1, 4, 3, 4, 5, 2, 9], 0]
    ])('should report the position of permutation within the list', (first, permutation, expectedPosition) => {
        const list = new PermutationList(first);
        const perm = list.getPermutation(permutation);
        expect(perm?.getPosition()).toBeCloseTo(expectedPosition)
    })
})
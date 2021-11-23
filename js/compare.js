// const textA = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer mauris lectus, imperdiet vitae gravida a, laoreet non sapien. Nullam vitae sem nibh. Integer ac est ac magna feugiat lobortis eget nec justo. Nunc ultrices ligula id porta congue. Nullam ut ligula turpis. Duis vel ipsum lectus. Maecenas sit amet est dapibus, viverra libero sit amet, consectetur purus. Cras eget ex lacinia, egestas quam nec, dictum mauris. In porta lacus orci, efficitur dignissim lorem euismod eu. Donec porta neque nulla, in efficitur odio bibendum egestas. Cras libero justo, egestas nec faucibus vitae, condimentum in lorem. Quisque vitae enim rhoncus, eleifend eros at, consequat odio. "
// const textB = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer mauris lectus, imperdiet vitae gravida a, laoreet non sapien. Nullam vitae sem nibh. Integer ac est ac magna feugiat lobortis eget nec justo. Nunc ultrices ligula id porta congue. Nullam ut ligula turpis. Duis vel ipsum lectus. Maecenas sit amet est dapibus, viverra libero sit amet, consectetur purus. Cras eget ex lacinia, egestas quam nec, dictum mauris. In porta lacus orci, efficitur dignissim lorem euismod eu. Donec porta neque nulla, in efficitur odio bibendum egestas. Cras libero justo, egestas nec faucibus vitae, condimentum in lorem. Quisque vitae enim rhoncus, eleifend eros at, consequat odio. "
// const textC = "Lorem ipsum dolor, consectetur adipiscing elit. Integer mauris lectus, imperdiet vitae gravida a, laoreet non sapien. Nullam vitae sem nibh. Integer ac est ac magna feugiat lobortis eget nec justo. Nunc ultrices ligula id porta congue. Nullam ut ligula turpis. Duis vel ipsum lectus. Maecenas sit amet est dapibus, viverra libero sit amet, consectetur purus. Cras eget ex lacinia, egestas quam nec, dictum mauris. In porta lacus orci, efficitur dignissim lorem euismod eu. Donec porta neque nulla, in efficitur odio bibendum egestas. Cras libero justo, egestas nec faucibus vitae, condimentum in lorem. Quisque vitae enim rhoncus, eleifend eros at, consequat odio. "

const compare = { K: 10}

compare.getDifferences = function(...texts){
    console.time('processing')
    const textObjects = compare.prepareTexts(texts)
    const dicts = compare.buildDicts(textObjects)
    const mergedDicts = compare.mergeDicts(dicts[0], dicts)
    const matches = compare.expandMatchingNGrams(mergedDicts, textObjects)
    const matchesByText = compare.matchesByText(matches)
    const unmatchedArray = compare.calculateUnmatchedArrays(matchesByText, textObjects)
    const unmatchedTexts = compare.calculateUnmatchedTexts(unmatchedArray, textObjects, texts)
    const unmatchedWithContext = compare.calculateContext(unmatchedTexts, matches)
    console.timeEnd('processing')
    return unmatchedTexts
}

compare.calculateContext = function(unmatchedTexts, matches){
    const textIds = Object.keys(unmatchedTexts)
    for(const textId of textIds){
        const diffs = unmatchedTexts[textId]
        for(const diff of diffs){
            for(const match of matches){
                if(match[textId]){
                    if(match[textId].to == diff.from){
                        diff.srcFrom = match[0].to
                    }else if (match[textId].from == diff.to){
                        diff.srcTo = match[0].from
                    }
                }
            }
        }
    }
}

compare.calculateUnmatchedTexts = function(arrays, textObjects, origTexts){
    const textIds = Object.keys(arrays)
    const unmatchedTexts = {}
    for(let id of textIds){
        unmatchedTexts[id] = compare.calculateUnmatchedText(arrays[id], textObjects[id].text, origTexts[id])
    }
    return unmatchedTexts
}

compare.calculateUnmatchedText = function(array, text, origText){
    const unmatches = []
    const counter = {}
    let inUnmatchedText = false
    let i, startIndex = 0
    for(i = 0; i < array.length; i++){
        let char = text.charAt(i)
        if(counter[char]) counter[char] ++;
        else counter[char] = 1

        if(array[i] && inUnmatchedText){
            unmatches.push(compare.createUnmatch(startIndex, i, text, counter, origText))
            inUnmatchedText = false
        }else if(!array[i] && !inUnmatchedText){
            startIndex = i
            inUnmatchedText = true
        }
    }
    if(inUnmatchedText){
        unmatches.push(compare.createUnmatch(startIndex, i, text, counter, origText))
    }
    return unmatches
}

compare.createUnmatch = function(start, end, text, counter, origText){
    const startChar = text.charAt(start)
    const endChar = text.charAt(end - 1)
    const unmatch = {
        urn: `${startChar}[${counter[startChar]}]-${endChar}[${counter[endChar]}]`,
        from: compare.urnToIndex(startChar, counter[startChar], origText),
        to: compare.urnToIndex(endChar, counter[endChar], origText) + 1,
    }
    unmatch.text = origText.substring(unmatch.from, unmatch.to)
    return unmatch 
}

compare.urnToIndex = function(char, count, text){
    let counter = 0
    let index = 0
    for(let character of text){
        if(char == character){
            counter ++
            if(counter == count){
                return index
            }
        }
        index ++
    }
    return index
}

compare.calculateUnmatchedArrays = function(matches, textObjects){
    const textIds = Object.keys(matches)
    const unmatched = {}
    for(let id of textIds){
        if (!unmatched[id]) unmatched[id] = compare.getNewMatchArray(textObjects[id].text)
        for(let match of matches[id]){
            for(let i = match.from; i < match.to; i++) unmatched[id][i] = true
        }
    }
    return unmatched
}

compare.getNewMatchArray = function(text){
    const arr = []
    for(let i = 0; i < text.length; i++) arr.push(false)
    return arr
}

compare.matchesByText = function(matches){
    const byText = {}
    for(let match of matches){
        const textIds = Object.keys(match)
        for(let id of textIds){
            if(!byText[id]) byText[id] = []
            byText[id].push(match[id])
        }
    }
    return byText
}

compare.expandMatchingNGrams = function(mergedDicts, texts){
    const ngrams = Object.keys(mergedDicts)
    let matches = []
    for(let ngram of ngrams){
        const newMatches = compare.expandMatchingNGram(mergedDicts[ngram], texts, matches)
        matches = [...matches, ...newMatches]
    }
    return matches
}

compare.expandMatchingNGram = function(matchingNGram, texts, existingMatches){
    const textIds = Object.keys(matchingNGram)
    const matches = []
    for(let i = 1; i < textIds.length; i++){
        const mainId = textIds[0]
        const otherId = textIds[i]
        for(let mainIndex of matchingNGram[mainId]){
            for(let otherIndex of matchingNGram[otherId]){
                const main = {id: mainId, index: mainIndex}
                const other = {id: otherId, index: otherIndex}
                const match = compare.expandMatchingNGramPair(main, other, texts, existingMatches)
                if(match) matches.push(match)
            }
        }
    }
    return matches
}

compare.expandMatchingNGramPair = function(main, other, texts, matches){
    if(compare.containedInExistingMatch(main, other, matches)) return

    const mainText = texts[main.id].text
    const otherText = texts[other.id].text

    let forward = 0
    let mainChar, otherChar
    let mainIndex, otherIndex
    do{
        mainIndex = main.index + forward
        otherIndex = other.index + forward
        if(mainIndex >= mainText.length || otherIndex >= otherText.length) break

        mainChar = mainText.charAt(mainIndex)
        otherChar = otherText.charAt(otherIndex)
        forward ++
    }while(mainChar == otherChar)
    forward --
    if(mainChar == otherChar) forward ++

    let backward = 0
    do{
        backward++
        mainIndex = main.index - backward
        otherIndex = other.index - backward
        if(mainIndex < 0 || otherIndex < 0) break

        mainChar = mainText.charAt(main.index - backward)
        otherChar = otherText.charAt(other.index - backward)
    }while(mainChar == otherChar)
    backward -= 1

    const match = {}
    match[main.id] =    {from:main.index - backward, to: main.index + forward}
    match[other.id] = {from:other.index - backward, to: other.index + forward}
    return match
}

compare.matchBoundsToText = function(match, text){
    return text.substring(match.from, match.to)
}

compare.containedInExistingMatch = function(main, other, matches){
    for(let match of matches){
        if(match[main.id] && match[other.id]){
            const mainMatch = match[main.id]
            const otherMatch = match[other.id]
            const mainContained = mainMatch.from < main.index && mainMatch.to > main.index
            const otherContained = otherMatch.from < other.index && otherMatch.to > other.index
            if(mainContained && otherContained) return true
        }
    }
    return false
}

compare.mergeDicts = function(mainDict, dicts){
    let mergedDict = {}
    const dictIds = Object.keys(dicts)
    for(let dictId of dictIds){
        const dict = dicts[dictId]
        if(dict === mainDict) continue
        mergedDict = compare.mergeDict(mergedDict, mainDict, dict)
    }
    return mergedDict
}

compare.mergeDict = function(mergedDict, mainDict, dict){
    const mainKeys = Object.keys(mainDict.entries)
    const dictKeys = Object.keys(dict.entries)
    const overlapKeys = []
    for(let mainKey of mainKeys){
        for(let dictKey of dictKeys){
            if(mainKey == dictKey) overlapKeys.push(dictKey)
        }
    }
    
    for(let overlapKey of overlapKeys){
        if(mergedDict[overlapKey]){
            mergedDict[overlapKey][dict.id] = dict.entries[overlapKey]
        }else{
            mergedDict[overlapKey] = {}
            mergedDict[overlapKey][mainDict.id] = mainDict.entries[overlapKey]
            mergedDict[overlapKey][dict.id] = dict.entries[overlapKey]
        }
    }
    return mergedDict
}

compare.buildDicts = function(texts){
    return texts.map(text => compare.buildDict(text))
}

compare.buildDict = function(textObject){
    const dict = {
        id: textObject.id,
        entries: {}
    }
    const text = textObject.text
    for(let i = 0; i < text.length - compare.K; i++){
        const ngram = text.substr(i, compare.K)
        if(dict.entries[ngram]){
            dict.entries[ngram].push(i)
        }else{
            dict.entries[ngram] = [i]
        }
    }
    return dict
}

compare.prepareTexts = function(texts){
    const preparedTexts = []
    for(let id = 0; id < texts.length; id++){
        preparedTexts.push({
            'id': id,
            'text': texts[id].trim().replace(/[\s\.,:;!\?]/g, '')
        })
    }
    return preparedTexts
}
//Contains all loaded editions
const editions = {toLoad: -1};
const cbdbCache = [];
let showingEditionSelect = false;
let relatedEditionA = "";
let relatedEditionB = "";//Make the edition switchable
let focusEdition = "MOD";
let focusChapter = "1";
let focusPassages = [1];
let currentSearch = undefined;
let isCitationVisible = false;

/**
 * Entry point of all the code, called when the document is loaded
 */
$(document).ready(()=>{
    //Prevent caching of any ajax requests, since our recipes can change
    $.ajaxSetup({cache:false});

    //First parse the GET Url
    parseURL();

    //Load data and start the chain reaction that loads this doc
    loadData();

    //Add the search listener
    addSearchListener();
    addIconToggleListeners();
});

/**
 * This tries to set the edition with the specified name as the focus edition
 */
function setFocusEdition(name){
    //If no edition with this name can be found, do nothing
    if(!editions[name]) return;

    focusEdition = name;
    const allEditions = Object.keys(editions);
    allEditions.splice(allEditions.indexOf(name), 1);
    allEditions.splice(allEditions.indexOf("toLoad"), 1);
    
    const editionA = allEditions[0];
    const editionB = allEditions.length > 1 ? allEditions[1] : "--";
    updateRelatedEditions(editionA, editionB)

    //Get the focus edition and set its tag atop the index list
    const focusEditionObj = editions[name];
    const editionName = focusEditionObj.text.edition.substring(0, focusEditionObj.text.edition.indexOf("edition"));
    $('#editionHeader').html("Edition: " + editionName);

    //Create the index list and view it on the page, also add the event listeners
    $('#indexList').html(createIndex(focusEditionObj, name));
    addIndexListeners();
    updateURL();
}

/**
 * Sets which of the other editions is being show in the columns next to this one
 * @param {String} editionA 
 * @param {String} editionB 
 */
function updateRelatedEditions(editionA, editionB){
  //Set the UI to show the related editions
  $('#relatedEditionA').html(`Edition ${editionA}`);
  relatedEditionA = editionA;
  $('#relatedEditionB').html(`Edition ${editionB}`);
  relatedEditionB = editionB;
}

/**
 * Loads the passages from the provided edition and chapter
 * @param {String} edition 
 * @param {Number} chapter 
 */
function setFocusChapter(edition, chapter){
    //Ignore empty chapters, editions or chapters that are not numbers
    if(isNaN(chapter) || !edition || !chapter) return;
    setSelectedChapter(edition, chapter);

    //Do some housekeeping
    chapter = parseInt(chapter);
    focusChapter = chapter;
    const focusEditionObj = editions[edition];

    //Set the passage header info
    const chapterInfo = getChapterInfo(focusEditionObj, chapter);
    $('#chapterHeader').html(`Chapter ${chapterInfo.num}. ${chapterInfo.title}`);
    updateRelatedEditions(relatedEditionA, relatedEditionB);

    //Now create the passagerows after selecting the right passages
    const selectedPassages = [];
    for(let passage of focusEditionObj.text.passages){
        if(passage.chapter == chapterInfo.num){
            selectedPassages.push(passage);
        }
    }
    //Fill the chapterBody with the HTml created from the selected passages
    $('#chapterBody').html(createPassageRows(selectedPassages));
    decorateMarkup();
    addPassageRowListeners();
    updateURL();
    //If we had a search query in the url, please show it now
    if(currentSearch){
        $('#searchField').val(decodeURI(currentSearch));
        currentSearch = undefined;
        doSearch();
    }
}

/**
 * Returns a list of all currently non-active editions
 */
function getPossibleRelatedEditions(){
    const allEditions = Object.keys(editions);
    allEditions.splice(allEditions.indexOf(focusEdition), 1);
    allEditions.splice(allEditions.indexOf("toLoad"), 1);
    return allEditions
}

/**
 * Shows the possible related editions that we can switch to
 * @param {String} related "A" or "B" 
 */
function showEditionSelect(event, related, forceHide){
    if(!forceHide) showingEditionSelect = !showingEditionSelect;
    else showingEditionSelect = false;

    if(showingEditionSelect){
        const otherEditions = getPossibleRelatedEditions();
        const content = []
        for(let edition of otherEditions){
            content.push(getEditionLink(edition, related))
        }
        const button = $(event.currentTarget).parent();
        const offset = button.offset();
        let posX = offset.left - 5;
        let posY = offset.top - 5;
        $('#editionSelectPopup').css({top: posY, left: posX, position: "absolute"});
        $('#editionSelectContent').html(content.join(""))
        $('#editionSelectPopup').show();
        $('#editionSelectIconA,#editionSelectIconB').attr('class', 'far fa-caret-square-up')
    }else{
        $('#editionSelectPopup').hide();
        $('#editionSelectIconA,#editionSelectIconB').attr('class', 'far fa-caret-square-down')
    }
}

/**
 * Sets one of the related editions
 * @param {String} related 
 * @param {String} edition 
 */
function setRelatedEdition(related, edition){
    showEditionSelect(undefined, undefined, true);
    if(related == 'A'){
        relatedEditionA = edition;
    }else if(related == 'B'){
        relatedEditionB = edition
    }
    setFocusChapter(focusEdition, focusChapter);
}

/**
 * Returns the small piece of HTML that is the selection inside of the editionpopup
 * @param {String} edition 
 * @param {String} related 
 */
function getEditionLink(edition, related){
    let currentText = "";
    if(related == 'A'){
        if(edition == relatedEditionA){
            currentText = " - current";
        }
    }else if(related == 'B'){
        if(edition == relatedEditionB){
            currentText = " - current";
        }
    }
    return `<div class='newRelatedEdition' onclick='setRelatedEdition("${related}","${edition}")'>${edition}&nbsp;${currentText}</div>
    `
}

/**
 * Returns the HTML generated for each of the provided visible passages
 * @param {Array} passages 
 */
function createPassageRows(passages){
    let html = "";
    for(let passage of passages){
        //Creates a single passage row
        const passageHTML = createSinglePassageRow(passage);
        if(passageHTML && passageHTML.length > 1) html += passageHTML;
    }
    //Return the generated HTML
    return html;
};

/**
 * Creates a single entry in the chapter body and returns its HTML
 * @param {Passage} passage 
 */
function createSinglePassageRow(passage){
    const relatedPassages = [];
    if(passage.related && passage.related.length > 0){
        for(let related of passage.related){
            relatedPassages.push({edition: related.edition, passage:getPassage(related.edition, related.id)});
        }
    }
    let relatedPassageHTML = "";
    let passageARelated = undefined;
    let passageBRelated = undefined;
    for(let related of relatedPassages){
        if(related.edition == relatedEditionA) passageARelated = related;
        if(related.edition == relatedEditionB) passageBRelated = related;
    }

    if(passageARelated == passageBRelated && passageARelated != undefined){
        relatedPassageHTML = createPassageHTML(passageARelated.edition, passageARelated.passage, true);
    }else{
        if(passageARelated){
            relatedPassageHTML += createPassageHTML(passageARelated.edition, passageARelated.passage);
        }
        if(passageBRelated){
            relatedPassageHTML += createPassageHTML(passageBRelated.edition, passageBRelated.passage);
        }
    }

    //Now finally compose the HTML and return the HTML string
    return `<div id='passage${passage.id}' class='passageRow blurb'><div class='row'>
    <div class='col-sm-6'>
    <span class='passage-id'>${passage.id}.</span>
    <p class='passage blurb'>${passage.html}<br></p>
    <p class='compared'></p>
    </div>

    ${relatedPassageHTML}
    </div></div>`;
}

/**
 * Decorates all the markup in the document
 * @param {String} html 
 */
function decorateMarkup(){
    //Remove all old decorators, and reapply
    $('.decorator').remove();
    $('.markup').each((index, item) => {
        const markupClasses = $(item).attr('class').split(' ');
        markupClasses.splice(markupClasses.indexOf('markup'), 1);
        
        const decorator = getDecoratorFor(markupClasses);
        $(item).prepend(decorator);
    });
    $('.markup').hover(focusMarkup, hidePopup);
}

/**
 * Called whenever the mouse leaves the span area of the markup,
 * this makes the popup invisible
 */
function hidePopup(){
    $('#popup').hide();
}

/**
 * Called whenever the mouse enters a Markup span
 * @param {EVent} event 
 */
function focusMarkup(event){
    const markup = $(event.currentTarget);
    const offset = markup.offset();
    let posX = offset.left;
    let posY = offset.top + markup.height();
    const content = getPopupContent(markup);
    $('#popup').html(content).css({top: posY, left: posX, position: "absolute"});
    $('#popup').show();
}

/**
 * Returns the content we want to display in the popup window
 * @param {JQuerySelector} markup 
 */
function getPopupContent(markup){
    const classes = $(markup).attr('class').split(" ");
    const content = getContentFor(classes, markup);
    return `
    ${getPopupClassheader(classes)}
    <p>${content}</p>
    `;
}

/**
 * Returns the appropriate class header for this popup window
 * @param {Array} classes 
 */
function getPopupClassheader(classes){
    return `<h6><i class='${getIconClassFor(classes, true)}'></i>&nbsp;${getClassDescriptor(classes)}</h6>`;
}

/**
 * Returns the content for the specified piece of markup. This basically just forwards
 * the information to the correct function based on the type of markup we get provided.
 * @param {Array} classes 
 * @param {JQuerySelector} markup 
 */
function getContentFor(classes, markup){
    if(arrayContainsAnyOf(classes, ["fullName", "partialName"])){
        if(classes.indexOf("noCBDBID") > -1) return "Nothing is known about this person.";
        else return getPeopleContent(markup, classes);
    }else if(classes.indexOf("officialTitle") > -1){
        return getOfficialTitleContent(markup);
    }else if(classes.indexOf("placeName") > -1){
        return getPlaceContent(markup);
    }else if(classes.indexOf("timePeriod") > -1){
        return getDateContent(markup);
    }
}

/**
 * Returns some more info on the date markup object we provided. This should not need external integration
 * @param {JQuerySelector} markup 
 */
function getDateContent(markup){
    let str = $(markup).attr('timeperiod_id');
    str = str.replace(/[\(\)]/g, '');
    str = str.replace(/&amp;/, '&');
    return str.replace(/&#(\d+);/g, function(match, dec) {
        return String.fromCharCode(dec);
    });
}

/**
 * Returns some personal data that we can extract from the tag and we can get from CBDB
 * @param {JQuerySelector} markup 
 */
function getPeopleContent(markup, classes){
    const cbdbid = markup.attr('cbdbid');
    
    const htmlURL = getCBDBURL(cbdbid);
    markup.attr('onclick', `openLink("${htmlURL}")`);
    const jsonURL = getCBDBURL(cbdbid, true);
    const timeCode = getTimeCode();
    if(isInCBDBCache(cbdbid)){
        const cachedOutput = retrieveFromCBDBCache(cbdbid);
        return cachedOutput;
    }else{
        $.get(jsonURL, (data) =>{
            const popupTimeCode = $('#popup').attr('timecode');
            //Ignore older requests than the current data in the popup
            if(popupTimeCode && popupTimeCode > timeCode) return;
            //Update the timecode and html content
            const info = data.Package.PersonAuthority.PersonInfo.Person.BasicInfo;
            const output = `
            <p><b>CBDBID:&nbsp;</b>${info.PersonId}<br>
            <b>Name:&nbsp;</b>${info.EngName}<br>
            <b>Birth-Death:&nbsp;</b>${info.YearBirth}-${info.YearDeath}<br>
            <b>Dynasty&nbsp;</b>${info.Dynasty}<br>
            <b>Notes&nbsp;</b>${info.Notes}<br><br>
            <i>Click markup to open full CBDB entry in new tab.</i></p>`;
            cbdbCache[info.PersonId] = output;
            $('#popup').attr('timecode', timeCode).html(getPopupClassheader(classes) + output);
        });
        return "Waiting for data from CBDB...";
    }
}

/**
 * Returns if the provided id has already been fetched before
 * @param {Integer} id 
 */
function isInCBDBCache(id){
    return cbdbCache[id] != undefined;
}

/**
 * Returns the item that is set at the provided cbdb id
 * @param {Integer} id 
 */
function retrieveFromCBDBCache(id){
    return cbdbCache[id];
}

/**
 * Opens the provided url as string in a new tab
 * @param {String} url 
 */
function openLink(url){
    const win = window.open(url, '_blank');
    win.focus();
}

/**
 * Returns some info from the markup data if we can find something using TGAZ
 * @param {JQuerySelector} markup 
 */
function getPlaceContent(markup){
    markup.attr('onclick', `openLink("${getTGAZURL(markup.text())}")`);
    return "<i>Click markup to open this entry in TGAZ in a new tab.</i>"
}

/**
 * Returns some info we can obtain from the official title. This is not much and we don't want to support this.
 * @param {JQuerySelector} markup 
 */
function getOfficialTitleContent(markup){
    return "Sorry, this edition currently does not support official titles.";
}

/**
 * Returns the decorator that is applicable for a piece of markup with the provided classes.
 * Also takes into account if we can currently show those classes
 * @param {Array} classes 
 */
function getDecoratorFor(classes){
    let iconClass =  getIconClassFor(classes);
    if(iconClass && iconClass.length > 1){
        return `<span class="decorator ${classes.join(" ")}"><i class="${iconClass}"></i></span>`;
    }
}

/**
 * Returns the fitting font-awesome icon class for a specific list of classes
 * @param {Array} classses 
 * @param {Boolean} ignoreIconSettings if we want to ignore the visibility settings in the top bar
 */
function getIconClassFor(classes, ignoreIconSettings){
    let iconClass = "";
    if(arrayContainsAnyOf(classes, ["fullName", "partialName"])){
        //First check if we are allowed to display it
        if(!$('#peopleIcon').hasClass("selected") && !ignoreIconSettings) return;
        if(classes.indexOf("noCBDBID") > -1){
            //UKNOWN person
            iconClass = "fas fa-user-slash";
        }else{
            //Known person
            iconClass = "fas fa-user";
        }
    }else if(arrayContainsAnyOf(classes, ["timePeriod"])){
        if(!$('#dateIcon').hasClass("selected") && !ignoreIconSettings) return;
        iconClass = "far fa-clock";
    }else if(arrayContainsAnyOf(classes, ["placeName"])){
        if(!$('#placeIcon').hasClass("selected") && !ignoreIconSettings) return;
        iconClass = "fas fa-map-marker-alt";
    }else if(arrayContainsAnyOf(classes, ["officialTitle"])){
        if(!ignoreIconSettings) return
        iconClass = "fas fa-crown";
    }
    return iconClass;
}

/**
 * Returns a nice sounding descriptor for a specific class collection markup
 * @param {Array} classes 
 */
function getClassDescriptor(classes){
    if(arrayContainsAnyOf(classes, ["fullName", "partialName"])){
        if(classes.indexOf("noCBDBID") > -1){
            //UKNOWN person
            return "Uknown Person";
        }else{
            //Known person
            return "Known Person";
        }
    }else if(arrayContainsAnyOf(classes, ["timePeriod"])){
        return "Date";
    }else if(arrayContainsAnyOf(classes, ["placeName"])){
        return "Place";
    }else if(arrayContainsAnyOf(classes, ["officialTitle"])){
        return "Official Title";
    }
}

/**
 * Checks if any of the provided needles can be found in the array
 * @param {Array} arr 
 * @param {Array} needles 
 */
function arrayContainsAnyOf(arr, needles){
    if(!arr || !needles) return false;
    for(let needle of needles){
        if(arr.indexOf(needle) > -1) return true;
    }
    return false;
}

/**
 * Creates a single related document entry next to an existing passage
 * @param {String} edition 
 * @param {Passage} passage 
 */
function createPassageHTML(edition, passage, spreadColumn){
    console.log(passage)
    const onClick = `setFocusPassage("${edition}", ${passage.id});`;
    return `<div class='col-sm-${spreadColumn ? 6 : 3}'>
    <span class='passage-id'>${edition}(${passage.id}).</span>
    <p class='passage blurb'>${passage.html}<br></p>
    <p class='compared'></p>
    <button class='btn btn-sm btn-outline-dark focusButton' style='display:none;' onclick='${onClick}'>focus this edition</button>
    </div>`;
}

/**
 * MAKE A SEARHC FUNCTION WITH A SEPARATE RESULTS PAGE 
 */

/**
 * 
 * @param {Edition} edition 
 * @param {Number} chapter 
 */
function getChapterInfo(edition, chapter){
    for(let c of edition.index){
        if(c.num == chapter) return c;
    }
    //If nothing was found, return nothing
    return undefined;
}

/**
 * Returns the HTML for the list of chapters for this edition
 * @param {Edition} edition 
 * @param {String} name
 */
function createIndex(edition, name){
    let html = "";
    let selectedClass = "";
    for(let chapter of edition.index){
        if(html.length < 1) selectedClass = "selected";
        else selectedClass = "";
        const chapterID = name + "_" + chapter.num;
        //Now append the DOM fragment 
        html += `<div id='${chapterID}' class='indexItem ${selectedClass}'>${chapter.num}. ${chapter.title}</div>`;
    }
    return html;
}

/**
 * Loads all editions from the backend
 */
function loadData(){
    //Load the main editions
    editions.toLoad = 4;
    loadEdition("MOD");
    loadEdition("GE");
    loadEdition("JIAN");
    loadEdition("NAN");
    //The linking file will be attempted to load after every edition load
}

/**
 * Loads the linking file from the data directory
 */
function loadLinking(){
    $.get("./data/linking.csv", (data)=>{
        parseLinking(data.split("\n"));
        
        //Set the correct focus edition, create the index, etc
        setFocusPassage(focusEdition, focusPassages[0], true);
        for(let passageID of focusPassages){
            showPassage(passageID, true);
        }
    });
}

/**
 * Called by clicking the focus on this edition button. Changes the currently focused edition
 * @param {String} edition 
 * @param {Number} passageID 
 */
function setFocusPassage(edition, passageID, firstload, dontScroll){
    $('#searchResults').hide();
    $('#editionBody').show();
    if(passageID.length < 1) passageID = "1";
    const focusPassage = getPassage(edition, passageID);
    setFocusEdition(edition);
    setFocusChapter(edition, focusPassage.chapter);
    if(!firstload) {
        focusPassages = [];
        showPassage(passageID);
        
        if(!dontScroll){
            $([document.documentElement, document.body]).animate({
                scrollTop: $("#passage" + passageID).offset().top
            }, 2000);
        }
    }
}

/**
 * Parses the url and loads from it
 */
function parseURL(){
    //First see if we even specified get parameters
    if(window.location.href.indexOf("?") > -1){
        const getString = window.location.href.split("?")[1];
        const getPairs = getString.split("&");
        for(const pair of getPairs){
            const key = pair.split("=")[0];
            const value = pair.split("=")[1];
            if(key === 'ed'){
                focusEdition = value;
            }else if(key === 'psg'){
                focusPassages = value.split(",");
            }else if(key === 'ch'){
                focusChapter = value;
            }else if(key == 'q'){
                currentSearch = value;
            }
        }
    }
}

/**
 * Updates the current URL to show the focus chapter, edition and passage
 */
function updateURL(showSearchURL, searchQuery){
    if(showSearchURL){
        window.history.pushState("", `ZGZY Browser, Search: ${searchQuery}`, 
        `?q=${searchQuery}`);
    }else{
    window.history.pushState("", `ZGZY Browser, Ed. ${focusEdition} Ch. ${focusChapter}`, 
    `?ed=${focusEdition}&ch=${focusChapter}&psg=${getFocusPassages()}`);
    }
}

/**
 * Returns a comma separated list of all the passages that are focused
 */
function getFocusPassages(){
    let focusPassages = [];
    $('.passageRow').each((index, item)=>{
        const passageRow = $(item);
        if(passageRow.hasClass('blurb')) return;
        else{
            focusPassages.push(passageRow.attr('id').split("passage")[1]);
        }
    });
    return focusPassages.join(",");
}

/**
 * Parses the lines that were loaded from the linking.csv file
 * @param {Array} lines 
 */
function parseLinking(lines){
    for(let line of lines){
        //Skip any lines that don't hold an @
        if(line.indexOf("@") == -1) continue;
        const parts = line.split(/[;,]/g);
        if(parts.length < 2) continue;
        //Parse only valid link lines
        parseSingleLink(parseLocation(parts[0]), parseLocation(parts[1]));
    }
}

/**
 * Parses this string as an @ separated edition location marker.
 * @param {String} s 
 */
function parseLocation(s){
    if(!s) return undefined;
    const parts = s.split("@");
    if(parts.length < 2) return undefined;
    //Now construct into a location object and return
    const location = {
        edition: parts[0].trim(),
        id: parts[1].trim()
    };
    return location;
}

/**
 * Parses one line of the link file and applies the link bidirectionally to the editions object
 * @param {Location}
 * @param {Location}
 */
function parseSingleLink(from, to){
    //If either parts of a link is undefined, skip this step
    if(!from || !to) return;
    //Get the two related passages
    const fromPassage = getPassage(from.edition, from.id);
    const toPassage = getPassage(to.edition, to.id);
    //Modify them to show their relation
    addRelatedLocationToPassage(fromPassage, to);
    addRelatedLocationToPassage(toPassage, from);
}

/**
 * Adds a related location descriptor to the provided passage. Using this information we can
 * find it in the other related edition
 * @param {Passage} passage 
 * @param {Location} relatedLocation
 */
function addRelatedLocationToPassage(passage, relatedLocation){
    //If we don't have an array of related locations yet, make it
    if(!passage.related || passage.related == undefined) passage.related = [];
    //Now that we have the array, push the related location into it
    passage.related.push(relatedLocation);
}

/**
 * Returns a reference to the passage described by the edition name and passage id
 * @param {String} editionName 
 * @param {Number} passageId 
 */
function getPassage(editionName, passageId){
    //Go through each of the passages and return the one with a matching passage id
    for(let passage of editions[editionName].text.passages){
        if(passage.id == passageId) return passage;
    }
    //If nothing was found, return undefined
    console.log("Could not find id =",passageId, "in edition =", editionName)
    return undefined;
}

/**
 * Loads the edition with the provided name
 * @param {String} name 
 */
function loadEdition(name){
    //Create an empty entry in the editions object for the edition we're about to load
    editions[name] = {};
    //Load index and body of the edition, then forward them to parsing functions
    $.get(`./data/${name}.csv`, (data)=>{
        parseIndex(name, data);
    });
    $.get(`./data/${name}.json`, (data)=>{
        editions[name].text = data;
        editions.toLoad --;
        //If we're done loading the text, load the linking
        if(editions.toLoad == 0) loadLinking();
    });
}

/**
 * Parses the provided data for the provided edition described by the name
 * @param {String} name 
 */
function parseIndex(name, data){
    //Prepare an empty index for this edition
    editions[name].index = [];
    //Split the data by lines and parse each line
    const lines = data.split("\n");
    for(let line of lines){
        const parts = line.split(/[;,]/g);
        if(isNaN(parts[0]) || parts.length < 2){
            //This means this is not a chapter number, so continue
        }else{
            const chapter = {
                num: parseInt(parts[0]),
                title: parts[1]
            }
            editions[name].index.push(chapter);
        }
    }
}

/**
 * Here we can add the Index click listeners
 */
function addIndexListeners(){
    //Add a click listener to the indexItems
    $('.indexItem').click((event)=>{
        //Now forward the request to the viewer and load that specific chapter
        const targetID = $(event.target).attr('id');
        const targetEdition = targetID.split("_")[0];
        const targetChapter = targetID.split("_")[1];
        $('#searchResults').hide();
        $('#editionBody').show();
        setFocusChapter(targetEdition, targetChapter);
    });
    $('.indexItem.selected').click();
}

/**
 * Shows the arrwo in front of the index list
 * @param {String} edition 
 * @param {Number} chapter 
 */
function setSelectedChapter(edition, chapter){
    $('.indexItem').removeClass('selected');
    $('.indexMarker').remove();
    const target = $(`#${edition}_${chapter}`);
    target.addClass('selected').prepend("<i class='indexMarker fas fa-arrow-circle-right'></i>");
}

/**
 * Adds the mouse listeners that collapse and uncollapse the passage rows
 */
function addPassageRowListeners(){
    $('.passageRow').unbind('click').click((event) =>{
        const passageRow = $(event.currentTarget);
        //If it is not already expanded, please expand it
        if(passageRow.hasClass('blurb')){
            //Show the passage that has its own ID
            showPassage(passageRow.attr('id').split("passage")[1]);
        }
    });
}

/**
 * Adds the listeners that check if the passage should be collapse again
*/
function addPassageCollapseListeners(){
    $('.passageCollapse').unbind('click').click((event)=>{
        const passageRow = $(event.currentTarget).parent();
        //Show the passage that has its own ID
        hidePassage(passageRow.attr('id').split("passage")[1]);
    });
}

/**
 * Shows the passage with the provided id
 * @param {Number} passageID 
 */
function showPassage(passageID, firstload){
    const passageRow = $('#passage' + passageID);
    passageRow.removeClass('blurb').find('.blurb').removeClass('blurb');
    if($('#diffIcon').hasClass('selected')){
        $(passageRow.find('.passage').hide())
        $(passageRow.find('.compared').show())
    }else{
        $(passageRow.find('.compared').hide())
        $(passageRow.find('.passage').show())
    }
    passageRow.find(".passageCollapse").remove();
    passageRow.append(`<button class='btn btn-sm btn-outline-dark passageCollapse' onclick='hidePassage(${passageID})'>Collapse</button>`);
    passageRow.unbind('click');
    passageRow.find('.focusButton').fadeIn();
    if(focusPassages.indexOf(passageID) > -1 && !firstload){
        focusPassages.push(passageID);
    }   
    updateURL();
    comparePassage(passageID)
}

/**
 * Whenever we open a passage, prepares it to run through comparengine
 * @param {Number} passageID 
 */
function comparePassage(passageID){
    console.log("comparing passage: " + passageID);
    const passageRow = $('#passage' + passageID);
    const passageSelectors = passageRow.find('.passage');
    const passages = []
    for(let passageSelector of passageSelectors){
        const passageText = $(passageSelector).text().trim();
        passages.push(passageText.substring(passageText.indexOf('. ') + 2));
    }
    const newPassages = highlightDifferences(compare.getDifferences(...passages), passages, passageID);
    const comparedSelectors = passageRow.find('.compared')
    for(let i = 0; i < comparedSelectors.length; i++){
        const selector = comparedSelectors.get(i)
        const newPassage = newPassages[i]
        $(selector).html(newPassage)
    }
}

/**
 * Highlights the differences between the two and applies the markup
 * @param {Array} differences 
 * @param {Array} passages 
 */
function highlightDifferences(differences, passages, passageID){
    let newPassages = []
    for(let i = 0; i < passages.length; i++){
        const diffs = differences[i]
        const passage = passages[i]
        let lastEnd = 0
        let parts = []
        for(let diff of diffs){
            console.log(diff)
            parts.push(passage.substring(lastEnd, diff.from))
            parts.push(`<span class="diff" onmouseover="highlightOther(${diff.srcFrom}, ${diff.srcTo}, ${passageID})", onmouseout="removeHighlights()">`)
            parts.push(passage.substring(diff.from, diff.to))
            parts.push('</span>')
            lastEnd = diff.to
        }
        parts.push(passage.substring(lastEnd))
        newPassages.push(parts.join(''))
    }
    return newPassages
}

/**
 * Highlights a segment in the main text
 * @param {Number} from 
 * @param {Number} to 
 */
function highlightOther(from, to, passageID){
    console.log(passageID)
    const comparedElement = $('#passage' + passageID + ' .compared').get(0)
    const text = comparedElement.innerHTML
    console.log(text)
    const newText = text.substring(0, from) + `<span class='context'>${text.substring(from, to)}</span>` +text.substring(to)
    $('#passage' + passageID + ' .compared').get(0).innerHTML = newText
}

/**
 * Removes all the 'other highlights' that were added by the highlightOther function
 */
function removeHighlights(){
    $('.context').contents().unwrap()
}

/**
 * Hides the passage with the provided id
 * @param {Number} passageID 
 */
function hidePassage(passageID){
    const passageRow = $('#passage' + passageID);
    passageRow.addClass('blurb').find('.passage').addClass('blurb');
    passageRow.find('.focusButton').hide();
    passageRow.find('.compared').hide()
    passageRow.find('.passageCollapse').remove();
    //Add a timeout, this makes it work for some wonky reason, nvm
    setTimeout(addPassageRowListeners, 200);
    while(focusPassages.indexOf(passageID) > -1){
        focusPassages.split(focusPassages.indexOf(passageID), 1);
    }
    updateURL();
}

/**
 * Adds the keydown listener to the searchfield on the top of the page
 */
function addSearchListener(){
    $('#searchField').bind('keydown', (event)=>{
        if(event.keyCode == 13) doSearch();
    });
}

/**
 * Hande the search field input. This is quite complex due the fact that it can be used to search for
 * id's or names.
 */
function doSearch(){
    //Get the input value and do input vaidation
    let query = $('#searchField').val();
    if(!query) return;
    query = query.trim();
    if(query.length < 1) return;

    //Now that we know its a valid input, lets handle the ids first
    if(!isNaN(query)){
        //Handle numeric id
        setFocusPassage(focusEdition, parseInt(query));
    }else{
        //Handle full text search, start by defining list of all editions
        const allEditions = Object.keys(editions);
        allEditions.splice(allEditions.indexOf("toLoad"), 1);
        //Then, for each edition do a text search
        const output = [];
        let numResults = 0;
        for(const editionName of allEditions){
            const edition = editions[editionName]
            const editionOutput = [];
            for(const passage of edition.text.passages){
                let outputText = passage.html;
                let replaced = 0;
                while(outputText.indexOf(query) > -1){
                    replaced ++;
                    numResults ++;
                    outputText = outputText.replace(query, '<span class="searchHighlight">%QUERY%</span>');
                }
                if(replaced > 0){
                    outputText = outputText.replace(/%QUERY%/g, query);
                    editionOutput.push(`<div class='searchResult' onclick='setFocusPassage("${editionName}", ${passage.id})'>
                    <b>${passage.chapter}.${passage.paragraph} ${editionName}(${passage.id})</b>
                    ${outputText}</div>`)
                }
            }
            output.push(`<h5>Edition ${editionName}</h5>` + editionOutput.join('<br>'));
        }
        showSearchResults(output.join("<hr/>"), query, numResults);
    }
}

/**
 * Shows the search results window with the provided HTML string as output
 * @param {String} output 
 * @param {String} query the string we have searched for
 */
function showSearchResults(output, query, numResults){
    $('#searchResults').html(`<h4>Search results for ${query}<br><sub>showing ${numResults} matches</sub></h4><br>` + output).show();
    $('#editionBody').hide();
    setTimeout(()=>{updateURL(true, query);}, 300);
}

/**
 * Adds the event listeners for the icon toggles
 */
function addIconToggleListeners(){
    $('.btn-icon-toggle').unbind('click').click((event)=>{
        const target = $(event.currentTarget);
        const clickedDiff = target.attr('id') == 'diffIcon'
        target.toggleClass('selected');
        if(!clickedDiff) $('#diffIcon').removeClass('selected')
        decorateMarkup();

        const comparisonEnabled = ($('#diffIcon').hasClass('selected'));
        if(comparisonEnabled){
            $('.passage:not(.blurb)').hide()
            $('.compared').show()
            $('.btn-icon-toggle.selected').removeClass('selected')
            $('#diffIcon').addClass('selected')
        }else{
            $('.passage').show()
            $('.compared').hide()
        }
    });
}

/**
 * Shows the citation overlay when the "How To Cite Us" button is being pressed
 */
function showCitationOverlay(){
    if(isCitationVisible){
        $('#citationOverlay').fadeOut();
    }else{
        $('#citationOverlay').fadeIn();
    }
    isCitationVisible = !isCitationVisible;
    $('#urlReference').html(window.location.href);
}

/**
 * Creates URL for using the CBDB API, it can either fetch the HTML for external linking
 * or just the JSON for internal processing
 * @param {Integer} id 
 * @param {Boolean} useJSON
 */
function getCBDBURL(id, useJSON){
    return `https://cbdb.fas.harvard.edu/cbdbapi/person.php?id=${id}${useJSON ? '&o=json' : ''}`;
}

/**
 * Used for internal housekeeping and generating unique id's
 */
function getTimeCode(){
    return (new Date()).getTime();
}

/**
 * Generates the TGAZ url for external opening
 * @param {String} name 
 */
function getTGAZURL(name){
    return "http://maps.cga.harvard.edu/tgaz/placename?n=" + name;
}
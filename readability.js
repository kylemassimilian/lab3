const fs = require("fs");
const md5File = require('md5-file');
const sqlite3 = require('sqlite3');
const Tokenizer = require('tokenize-text');
const tokenize = new Tokenizer();
const tokenizeEnglish = require("tokenize-english")(tokenize);

const db = new sqlite3.Database('reading.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        throw err;
    }
});
// Parses a text file into words, sentences, characters
function readability(filename, callback) {
    fs.readFile(filename, "utf8", (err, contents) => {
        if (err) throw err;
        //uses md5 per its documentation to hash the specific file name
        let hash = md5File.sync(filename);
        //creates the SQL command that will be passed in to check for that hash
        let sql = `SELECT * FROM reading WHERE hash = ?`;
        db.get(sql, [hash], (err, row) =>
        {
            if(err){
              throw err;}
          //if there is already a row with that hash, we get its SQL values rather than tokenize again
          if(row){
            //using row, we can retrieve the SQL values linearly as we already tokenized
            callback({
              filename: filename,
              words: row.wordCount,
              sentences: row.sentenceCount,
              characters: row.characterCount,
              cL: row.cL,
              aRI: row.aRI
            });
        }
        //if we haven't yet analyzed this text, we use tokenize to determine values
          else{
            //uses a regular expression and then extraction to get the numbers
            let extractNumber = tokenize.re(/[0-9]/);
            let number = extractNumber(contents);
            //tells us the amount of numbers in the text
            let numbers = number.length;
            //does the same as above but with a regular expression for letters
            let extractLetters = tokenize.re(/[A-Za-z]/);
            let letter = extractLetters(contents);
            let letters = letter.length;
            //adds the amount of numbers and letters for total characters
            let characters = number.length + letter.length;
            //tokenizes to count the amount of words
            let words = tokenize.words()(contents).length;
            //uses split to ignore new lines in counting for sentences
            const nonewlines = contents.split(/\n/).join(' ');
            let sentences = tokenizeEnglish.sentences()(nonewlines).length;
            //computes the coleman Liau index using the function below and values determined
            let cL = colemanLiau(letters, words, sentences);
            //does the same for the automated readability index
            let aRI = automatedReadabilityIndex(letters, numbers, words, sentences);
            //uses a callback function, passing in the values to display in console
            callback(
              {
              filename: filename,
              words: words,
              characters: characters,
              sentences: sentences,
              cL: cL,
              aRI: aRI})
            //because this is the first time the text has been interpreted, we add it to SQL table
            db.run('INSERT INTO reading(textName, wordCount, letterCount, numberCount, characterCount, sentenceCount, cL, aRI, hash) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)', [filename, words, letters, numbers, characters, sentences, cL, aRI, hash], (err) =>
            {
              if (err) {
                throw err;
              }
            })
        };
      });
    });
}

// Computes Coleman-Liau readability index
function colemanLiau(letters, words, sentences) {
    return (0.0588 * (letters * 100 / words))
        - (0.296 * (sentences * 100 / words))
        - 15.8;
}

// Computes Automated Readability Index
function automatedReadabilityIndex(letters, numbers, words, sentences) {
    return (4.71 * ((letters + numbers) / words))
        + (0.5 * (words / sentences))
        - 21.43;
}

// Calls the readability function on the provided file and defines callback behavior
if (process.argv.length >= 3) {
    readability(process.argv[2], data => {
      //creates a concatenated string using values passed into the callback to display results
        console.log("REPORT for " + data.filename + "\nWord Count: " + data.words + "\nCharacter Count: " + data.characters + "\nSentence Count: " + data.sentences + "\nColeman-Liau Score: " + data.cL + "\nAutomated Readability Index: " + data.aRI);
    });
}
else {
    console.log("Usage: node readability.js <file>");
}

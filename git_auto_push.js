const  {execSync} = require('child_process');

try {
    // step 1: stage all changes
    execSync('git add .');

    //step 2: commit changes with a message
    const commitMessage = 'Latest changes' || process.argv[2];
    execSync(`git commit -m "${commitMessage}"`);

    // step 3: push changes to the remote repository
    execSync('git push origin mallik');

    console.log('Changes pushed to remote repository successfully.');
} catch (error) {
    console.error('Error during git operations:', error.message);
    process.exit(1);
}
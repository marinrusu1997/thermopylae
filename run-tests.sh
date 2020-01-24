RUN_IN_PARALLEL=false

if [ "$1" == "parallel" ]; then
    RUN_IN_PARALLEL=true;
    echo "Running tests in parallel...";
fi

for dir in */ ; do
    echo "Running tests for: $dir";
    cd "$dir" || exit;
    if [ $RUN_IN_PARALLEL == true ]; then
        npm run test &
    else
        npm run test;
    fi
    cd "..";
done

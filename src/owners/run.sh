ps -aelf | grep server.js | grep owner | awk '{print $4}' | xargs kill -9
for i in {0..4}
do
   if [ ! -d owner$i ]; then
      echo creating owner$i
      mkdir owner$i
      cat /dev/urandom |tr -dc A-Z9|head -c${1:-81} > owner$i/seed
   fi
   echo "starting owner$i"
   port=$((7000 + i))
   node server.js owner$i $port &
done

sleep 10

while true
do
    sleep 1
    continue
    x=`python run1.py`
    if [[ -z "$x" ]]; then
        sleep 1
	continue
    fi
    echo $x
    currentDate=`date`
    echo 'UPDATE request sent at' $currentDate
    eval "$x"
    currentDate=`date`
    echo 'UPDATE response received at' $currentDate
    echo ''
    echo ''
done

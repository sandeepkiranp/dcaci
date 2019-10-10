ps -aelf | grep server.js | grep subject | awk '{print $4}' | xargs kill -9
for i in {0..2}
do
   if [ ! -d subject$i ]; then
      echo creating subject$i
      mkdir subject$i
      cat /dev/urandom |tr -dc A-Z9|head -c${1:-81} > subject$i/seed
   fi
   echo "starting subject$i"
   port=$((9000 + i))
   node server.js subject$i $port &
done

sleep 15 

while true
do
    currentDate=`date`
    echo 'request sent at' $currentDate
    python run.py
    currentDate=`date`
    echo 'response received at' $currentDate
    echo ''
#    sleep 60
done

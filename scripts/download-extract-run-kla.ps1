# PowerShel script to run a Kiuwan baseline Analysis

Write-Host "Downloading KLA..."
Invoke-WebRequest -OutFile KiuwanLocalAnalyzer.zip https://www.kiuwan.com/pub/analyzer/KiuwanLocalAnalyzer.zip

Write-Host "Installing KLA..."
Expand-archive .\KiuwanLocalAnalyzer.zip -DestinationPath .

Write-Host "Running KLA..."
.\KiuwanLocalAnalyzer\bin\agent.cmd -n $(System.TeamProject) -s $(Build.SourcesDirectory) -l "TFS build $(Build.BuildNumber)" -c -wr --user $(KiuwanUser) --pass $(KiuwanPasswd) supported.technologies=abap,actionscript,aspnet,c,cobol,cpp,csharp,html,informix,java,javascript,jcl,jsp,natural,objectivec,oracleforms,perl,php,plsql,powerscript,python,rpg4,ruby,transactsql,vb6,vbnet,xml exclude.patterns=**/KiuwanLocalAnalyzer/**,**/*.min.js,**/*.Designer.vb,**/*Reference.vb,**/*Service.vb,**/*Silverlight.vb,**/*.Designer.cs,**/*Reference.cs,**/*Service.cs,**/*Silverlight.cs,**/.*,**/Pods/BuildHeaders/**/*.h,**/Pods/Headers/**/*.h include.patterns=**/** encoding=UTF-8 timeout=3600000 